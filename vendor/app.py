#!/usr/bin/env python3
"""
PatchMaster — Vendor Portal (Customer & License Management)
Production-ready Flask app for vendor-side operations.

Usage:
    # Development
    python app.py --debug

    # Production (via Gunicorn)
    gunicorn app:app --bind 0.0.0.0:5050 --workers 2
"""
import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import urllib.parse
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps
from argon2 import PasswordHasher, exceptions

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from flask import (
    Flask, render_template, request, redirect, url_for,
    flash, jsonify, session, g,
)
from flask_wtf.csrf import CSRFProtect

# ── Optional rate limiting (install flask-limiter for production) ──
try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address
    _LIMITER_AVAILABLE = True
except ImportError:
    _LIMITER_AVAILABLE = False
    logger_pre = logging.getLogger("vendor-portal")
    logger_pre.warning(
        "flask-limiter is not installed — login brute-force protection is DISABLED. "
        "Run: pip install flask-limiter"
    )

# ── App Version ────────────────────────────────────────────────
VERSION = "2.0.0"
PLACEHOLDER_VALUES = {
    "",
    "change-me",
    "replace-me",
    "PatchMaster-License-SignKey-2026-Secure",
    "changeme-set-a-strong-random-secret-here",
}

# SECURITY_GUARD_INSERTED
# ── Startup guard: block insecure default credentials ──────────
_RAW_ADMIN_PASS = os.environ.get("CM_ADMIN_PASS", "")
_WEAK_PASSWORDS = {
    "", "admin123", "admin", "changeme", "password", "1234", "12345", "123456",
    "password123", "admin1", "root", "toor", "pass", "test", "guest", "user",
    "default", "letmein", "welcome", "qwerty", "abc123", "monkey", "dragon",
    "master", "sunshine", "princess", "football", "shadow", "michael", "jennifer"
}
if _RAW_ADMIN_PASS in _WEAK_PASSWORDS:
    import sys as _sys
    _guard_log = logging.getLogger("vendor-portal")
    _guard_log.critical(
        "STARTUP BLOCKED: CM_ADMIN_PASS is not set or uses a weak default value '%s'. "
        "Set a strong password via the CM_ADMIN_PASS environment variable.",
        _RAW_ADMIN_PASS or "<empty>",
    )
    if os.environ.get("ALLOW_WEAK_PASSWORD", "").lower() not in {"1", "true", "yes"}:
        _sys.exit(
            "ERROR: Refusing to start with weak/default CM_ADMIN_PASS. "
            "Set a strong password or set ALLOW_WEAK_PASSWORD=true to override (dev only)."
        )



class Catalog(dict):
    """Dictionary with a safe fallback for legacy DB values."""

    def __init__(self, *args, fallback_factory=None, **kwargs):
        super().__init__(*args, **kwargs)
        self._fallback_factory = fallback_factory or (lambda key: {"label": str(key)})

    def __missing__(self, key):
        value = self._fallback_factory(key)
        self[key] = value
        logger.warning("Vendor portal encountered unknown catalog key '%s'; using fallback metadata.", key)
        return value


def safe_json_loads(value, default):
    try:
        return json.loads(value) if value else default
    except Exception:
        return default


def parse_int_field(raw_value, default=0):
    try:
        return int(str(raw_value).strip())
    except Exception:
        return default


def _is_placeholder_value(value):
    value = (value or "").strip()
    if value in PLACEHOLDER_VALUES:
        return True
    lowered = value.lower()
    return lowered.startswith("changeme-") or lowered.startswith("replace-me")


def _read_env_value_from_file(path, key):
    try:
        with open(path, "r", encoding="utf-8") as fh:
            for raw_line in fh:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                name, value = line.split("=", 1)
                if name.strip() == key:
                    clean = value.split("#", 1)[0].strip().strip("\"'")
                    if clean:
                        return clean
    except Exception:
        pass
    return ""


def _load_setting(key):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    install_dir = os.environ.get("INSTALL_DIR", "").strip()
    direct = os.environ.get(key, "").strip()
    if direct and not _is_placeholder_value(direct):
        return direct
    candidates = [
        os.environ.get("VENDOR_PORTAL_ENV", "").strip(),
        os.path.join(install_dir, ".env") if install_dir else "",
        os.path.join(os.getcwd(), ".env"),
        os.path.join(base_dir, ".env"),
        os.path.join(base_dir, "..", ".env"),
    ]
    seen = set()
    for candidate in candidates:
        if not candidate:
            continue
        candidate = os.path.abspath(candidate)
        if candidate in seen or not os.path.isfile(candidate):
            continue
        seen.add(candidate)
        value = _read_env_value_from_file(candidate, key)
        if value and not _is_placeholder_value(value):
            os.environ[key] = value
            return value
    return ""

# ── Logging ────────────────────────────────────────────────────
logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("vendor-portal")

# ── App Setup ──────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.environ.get("CM_SECRET_KEY", secrets.token_hex(32))
csrf = CSRFProtect(app)

# LIMITER_SHIM_INSERTED
# ── Rate Limiter setup ──────────────────────────────────────────
if _LIMITER_AVAILABLE:
    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=[],        # no global limit; applied per-route only
        storage_uri="memory://",  # swap for Redis URI in production
    )
else:
    class _NoOpLimiter:
        def limit(self, *a, **kw):
            def decorator(f):
                return f
            return decorator
    limiter = _NoOpLimiter()


# Production settings
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
    MAX_CONTENT_LENGTH=16 * 1024 * 1024,  # 16 MB max upload
)

# In production with HTTPS, enable secure cookies
if os.environ.get("HTTPS_ENABLED", "").lower() == "true":
    app.config["SESSION_COOKIE_SECURE"] = True

DATABASE_URL = os.environ.get("CM_DATABASE_URL",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "customers.db"))

SCHEMA_COLUMNS = {
    "customers": {
        "name": "TEXT NOT NULL DEFAULT ''",
        "email": "TEXT NOT NULL DEFAULT ''",
        "company": "TEXT NOT NULL DEFAULT ''",
        "phone": "TEXT NOT NULL DEFAULT ''",
        "address": "TEXT NOT NULL DEFAULT ''",
        "notes": "TEXT NOT NULL DEFAULT ''",
        "status": "TEXT NOT NULL DEFAULT 'active'",
        "created_at": "TEXT NOT NULL DEFAULT ''",
        "updated_at": "TEXT NOT NULL DEFAULT ''",
    },
    "purchases": {
        "customer_id": "INTEGER NOT NULL DEFAULT 0",
        "tier": "TEXT NOT NULL DEFAULT 'basic'",
        "plan": "TEXT NOT NULL DEFAULT 'testing'",
        "max_hosts": "INTEGER NOT NULL DEFAULT 0",
        "amount": "REAL NOT NULL DEFAULT 0",
        "currency": "TEXT NOT NULL DEFAULT 'USD'",
        "payment_method": "TEXT NOT NULL DEFAULT ''",
        "payment_ref": "TEXT NOT NULL DEFAULT ''",
        "status": "TEXT NOT NULL DEFAULT 'completed'",
        "notes": "TEXT NOT NULL DEFAULT ''",
        "purchased_at": "TEXT NOT NULL DEFAULT ''",
        "created_at": "TEXT NOT NULL DEFAULT ''",
    },
    "licenses": {
        "purchase_id": "INTEGER NOT NULL DEFAULT 0",
        "customer_id": "INTEGER NOT NULL DEFAULT 0",
        "license_id": "TEXT NOT NULL DEFAULT ''",
        "license_key": "TEXT NOT NULL DEFAULT ''",
        "tier": "TEXT NOT NULL DEFAULT 'basic'",
        "plan": "TEXT NOT NULL DEFAULT 'testing'",
        "features": "TEXT NOT NULL DEFAULT '[]'",
        "max_hosts": "INTEGER NOT NULL DEFAULT 0",
        "tool_version": "TEXT NOT NULL DEFAULT '2.0'",
        "version_compat": "TEXT NOT NULL DEFAULT '2.x'",
        "hw_id": "TEXT NOT NULL DEFAULT ''",
        "issued_at": "TEXT NOT NULL DEFAULT ''",
        "expires_at": "TEXT NOT NULL DEFAULT ''",
        "is_revoked": "INTEGER NOT NULL DEFAULT 0",
        "revoked_at": "TEXT",
        "revoke_reason": "TEXT NOT NULL DEFAULT ''",
        "activated": "INTEGER NOT NULL DEFAULT 0",
        "activated_at": "TEXT",
        "created_at": "TEXT NOT NULL DEFAULT ''",
    },
    "tool_versions": {
        "version": "TEXT NOT NULL DEFAULT ''",
        "codename": "TEXT NOT NULL DEFAULT ''",
        "release_date": "TEXT NOT NULL DEFAULT ''",
        "changelog": "TEXT NOT NULL DEFAULT ''",
        "min_tier": "TEXT NOT NULL DEFAULT 'basic'",
        "is_latest": "INTEGER NOT NULL DEFAULT 0",
        "download_url": "TEXT NOT NULL DEFAULT ''",
        "file_hash": "TEXT NOT NULL DEFAULT ''",
        "created_at": "TEXT NOT NULL DEFAULT ''",
    },
    "activity_log": {
        "action": "TEXT NOT NULL DEFAULT ''",
        "entity_type": "TEXT NOT NULL DEFAULT ''",
        "entity_id": "INTEGER",
        "details": "TEXT NOT NULL DEFAULT ''",
        "created_at": "TEXT NOT NULL DEFAULT ''",
    },
    "portal_users": {
        "username": "TEXT NOT NULL DEFAULT ''",
        "password_hash": "TEXT NOT NULL DEFAULT ''",
        "role": "TEXT NOT NULL DEFAULT 'viewer'",
        "is_active": "INTEGER NOT NULL DEFAULT 1",
        "created_at": "TEXT NOT NULL DEFAULT ''",
        "updated_at": "TEXT NOT NULL DEFAULT ''",
    },
}

SCHEMA_SQL = """
    CREATE TABLE IF NOT EXISTS customers (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        email       TEXT    NOT NULL,
        company     TEXT    NOT NULL DEFAULT '',
        phone       TEXT    NOT NULL DEFAULT '',
        address     TEXT    NOT NULL DEFAULT '',
        notes       TEXT    NOT NULL DEFAULT '',
        status      TEXT    NOT NULL DEFAULT 'active',
        created_at  TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at  TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS purchases (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        tier            TEXT    NOT NULL,
        plan            TEXT    NOT NULL,
        max_hosts       INTEGER NOT NULL DEFAULT 0,
        amount          REAL    NOT NULL DEFAULT 0,
        currency        TEXT    NOT NULL DEFAULT 'USD',
        payment_method  TEXT    NOT NULL DEFAULT '',
        payment_ref     TEXT    NOT NULL DEFAULT '',
        status          TEXT    NOT NULL DEFAULT 'completed',
        notes           TEXT    NOT NULL DEFAULT '',
        purchased_at    TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        created_at      TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS licenses (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id     INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
        customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        license_id      TEXT    NOT NULL UNIQUE,
        license_key     TEXT    NOT NULL,
        tier            TEXT    NOT NULL,
        plan            TEXT    NOT NULL,
        features        TEXT    NOT NULL DEFAULT '[]',
        max_hosts       INTEGER NOT NULL DEFAULT 0,
        tool_version    TEXT    NOT NULL DEFAULT '2.0',
        version_compat  TEXT    NOT NULL DEFAULT '2.x',
        hw_id           TEXT    NOT NULL DEFAULT '',
        issued_at       TEXT    NOT NULL,
        expires_at      TEXT    NOT NULL,
        is_revoked      INTEGER NOT NULL DEFAULT 0,
        revoked_at      TEXT,
        revoke_reason   TEXT    NOT NULL DEFAULT '',
        activated       INTEGER NOT NULL DEFAULT 0,
        activated_at    TEXT,
        created_at      TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS tool_versions (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        version         TEXT    NOT NULL UNIQUE,
        codename        TEXT    NOT NULL DEFAULT '',
        release_date    TEXT    NOT NULL,
        changelog       TEXT    NOT NULL DEFAULT '',
        min_tier        TEXT    NOT NULL DEFAULT 'basic',
        is_latest       INTEGER NOT NULL DEFAULT 0,
        download_url    TEXT    NOT NULL DEFAULT '',
        file_hash       TEXT    NOT NULL DEFAULT '',
        created_at      TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS activity_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        action      TEXT    NOT NULL,
        entity_type TEXT    NOT NULL DEFAULT '',
        entity_id   INTEGER,
        details     TEXT    NOT NULL DEFAULT '',
        created_at  TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS portal_users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT    NOT NULL UNIQUE,
        password_hash TEXT    NOT NULL,
        role          TEXT    NOT NULL DEFAULT 'viewer',
        is_active     INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        updated_at    TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
"""

# ── Auth helpers (placed early so routes can use decorator) ─────
# NOTE: login_required and admin_required are defined in the Auth section below,
# after the DB helpers. Routes that need them are defined after that section.

# ── License constants (must match PatchMaster product) ─────────
DEFAULT_SIGN_KEY = _load_setting("LICENSE_SIGN_KEY")
DEFAULT_SIGN_PRIVATE_KEY = _load_setting("LICENSE_SIGN_PRIVATE_KEY")
DEFAULT_VERIFY_PUBLIC_KEY = _load_setting("LICENSE_VERIFY_PUBLIC_KEY")
DEFAULT_ENCRYPT_PUBLIC_KEY = _load_setting("LICENSE_ENCRYPT_PUBLIC_KEY")
DEFAULT_ENABLE_ACTIVATION_CALLBACK = _load_setting("PM_VENDOR_ENABLE_ACTIVATION_CALLBACK").lower() in {"1", "true", "yes", "on"}
if not DEFAULT_SIGN_PRIVATE_KEY and not DEFAULT_SIGN_KEY:
    raise RuntimeError(
        "No vendor signing material is configured. "
        "Set LICENSE_SIGN_PRIVATE_KEY for new asymmetric signing or "
        "LICENSE_SIGN_KEY for legacy shared-secret signing."
    )
TOOL_VERSION = "2.0"
VERSION_COMPAT = "2.x"


def _decode_key_bytes(value):
    text = (value or "").strip()
    if not text:
        return b""
    padding = "=" * ((4 - len(text) % 4) % 4)
    try:
        return base64.urlsafe_b64decode((text + padding).encode())
    except Exception:
        return b""


def _derive_public_key(private_key):
    private_bytes = _decode_key_bytes(private_key)
    if not private_bytes:
        return ""
    try:
        public_bytes = Ed25519PrivateKey.from_private_bytes(private_bytes).public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        return base64.urlsafe_b64encode(public_bytes).decode().rstrip("=")
    except Exception:
        return ""


def _resolve_signing_material(sign_key=None, private_key=None, public_key=None):
    resolved_private = (private_key or DEFAULT_SIGN_PRIVATE_KEY or "").strip()
    resolved_sign = (sign_key or DEFAULT_SIGN_KEY or "").strip()
    resolved_public = (public_key or DEFAULT_VERIFY_PUBLIC_KEY or "").strip()
    if resolved_private and not resolved_public:
        resolved_public = _derive_public_key(resolved_private)
    return resolved_sign, resolved_private, resolved_public


def _resolve_encrypt_public_key(encrypt_public_key=None):
    return (encrypt_public_key or DEFAULT_ENCRYPT_PUBLIC_KEY or "").strip()


def _sign_license_payload(message, sign_key, private_key):
    if private_key:
        private_bytes = _decode_key_bytes(private_key)
        signer = Ed25519PrivateKey.from_private_bytes(private_bytes)
        signature = signer.sign(message.encode()).hex()
        return signature, "ed25519"
    if not sign_key:
        raise RuntimeError("No signing secret or private key is configured for vendor license generation.")
    signature = hmac.new(sign_key.encode(), message.encode(), hashlib.sha256).hexdigest()
    return signature, "hmac-sha256"


def _derive_pm2_aead_key(shared_secret):
    return HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=b"patchmaster-pm2-license-v1",
    ).derive(shared_secret)


def _encode_json_b64(value):
    return base64.urlsafe_b64encode(
        json.dumps(value, separators=(",", ":")).encode()
    ).decode().rstrip("=")


def _build_pm2_license(payload, sign_key, private_key, encrypt_public_key):
    public_bytes = _decode_key_bytes(encrypt_public_key)
    if not public_bytes:
        raise RuntimeError("Invalid LICENSE_ENCRYPT_PUBLIC_KEY for PM2 license generation.")
    recipient = X25519PublicKey.from_public_bytes(public_bytes)
    ephemeral_private = X25519PrivateKey.generate()
    ephemeral_public = ephemeral_private.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    shared_secret = ephemeral_private.exchange(recipient)
    aead_key = _derive_pm2_aead_key(shared_secret)
    nonce = secrets.token_bytes(12)
    header = {
        "v": 5,
        "license_id": payload["license_id"],
        "sig_alg": "ed25519" if private_key else "hmac-sha256",
        "enc_alg": "x25519-aes256gcm",
    }
    header_b64 = _encode_json_b64(header)
    ciphertext = AESGCM(aead_key).encrypt(nonce, json.dumps(payload, separators=(",", ":")).encode(), header_b64.encode())
    envelope = {
        "epk": base64.urlsafe_b64encode(ephemeral_public).decode().rstrip("="),
        "nonce": base64.urlsafe_b64encode(nonce).decode().rstrip("="),
        "ct": base64.urlsafe_b64encode(ciphertext).decode().rstrip("="),
    }
    envelope_b64 = _encode_json_b64(envelope)
    signed_message = f"{header_b64}.{envelope_b64}"
    signature, payload["sig_alg"] = _sign_license_payload(signed_message, sign_key, private_key)
    payload["enc_alg"] = header["enc_alg"]
    payload["license_format"] = "PM2"
    return f"PM2-{signed_message}.{signature}", payload

# ── License Plans: durations + base pricing per host/year ──────
# Pricing benchmarked against Ansible Automation Platform (~$14/node/yr),
# Puppet Enterprise (~$12/node/yr), and SaltStack (~$15/node/yr).
# PatchMaster is positioned 20-30% cheaper at $9/node/yr base.
PLANS = Catalog(
    {
        # ── Free evaluation plans (no charge, limited binding) ──
        "poc":      {"days": 14,   "label": "POC (14 Days)",    "price_per_host_yr": 0,    "no_bind": True,  "discount": 0.00, "price": 0},
        "testing":  {"days": 30,   "label": "Testing (30 Days)","price_per_host_yr": 0,    "no_bind": True,  "discount": 0.00, "price": 0},
        # ── Commercial plans ────────────────────────────────────
        "annual":   {"days": 365,  "label": "1-Year License",  "price_per_host_yr": 9.00,  "no_bind": False, "discount": 0.00, "price": 9.00},
        "3year":    {"days": 1095, "label": "3-Year License",  "price_per_host_yr": 8.10,  "no_bind": False, "discount": 0.10, "price": 8.10},  # 10% off
        "5year":    {"days": 1825, "label": "5-Year License",  "price_per_host_yr": 7.20,  "no_bind": False, "discount": 0.20, "price": 7.20},  # 20% off
    },
    fallback_factory=lambda key: {
        "days": 365,
        "label": str(key).replace("_", " ").title(),
        "price_per_host_yr": 9.00,
        "no_bind": False,
        "discount": 0.00,
    },
)

# ── Helper: compute license total amount ───────────────────────
def compute_license_amount(tier_key, plan_key, max_hosts):
    """Return total USD amount for a given tier + plan + host count."""
    plan   = PLANS[plan_key]
    tier   = TIERS[tier_key]
    hosts  = max(1, max_hosts or tier.get("default_hosts", 10))
    years  = max(1, round(plan["days"] / 365, 2))
    base   = plan["price_per_host_yr"] * tier["price_mult"] * hosts * years
    total  = round(base * (1 - plan["discount"]), 2)
    return total

# ── Feature catalogs ───────────────────────────────────────────
CORE_FEATURES = [
    "dashboard", "hosts", "groups", "patches", "snapshots",
    "compare", "offline", "schedules", "jobs", "onboarding",
    "settings", "license", "linux_patching",
]

STANDARD_ADDONS = [
    "compliance", "cve", "audit", "notifications", "users",
    "local-repo", "monitoring", "wsus", "reports", "software",
    "windows_patching",
]

DEVOPS_ADDONS = ["cicd", "git", "monitoring", "testing", "policies"]

BACKUP_ADDONS = ["backup_db", "backup_file", "backup_vm", "backup_live", "backups"]

ALL_FEATURES = sorted(set(
    CORE_FEATURES + STANDARD_ADDONS + DEVOPS_ADDONS + BACKUP_ADDONS +
    ["ring_rollout", "network_boot", "provisioning", "runbooks", "sla_drills"]
))

TIERS = Catalog(
    {
        # ─── Basic ── $9/host/yr ────────────────────────────────
        "basic": {
            "label": "Basic",
            "description": "Core patching for up to 10 hosts — Linux focus",
            "price_mult": 1.0,      # $9.00/host/yr
            "features": CORE_FEATURES[:],
            "default_hosts": 10,
            "smart_features": [
                "Automated patch scheduling",
                "Pre-patch snapshots & rollback",
                "Linux package manager support (apt/yum/dnf/pacman/zypper)",
                "Offline wheel cache for air-gapped installs",
                "Host inventory & heartbeat monitoring",
            ],
        },
        # ─── Basic + DevOps ── $13.50/host/yr ──────────────────
        "basic_devops": {
            "label": "Basic + DevOps",
            "description": "Basic tier + CI/CD pipelines & monitoring (10 Hosts)",
            "price_mult": 1.5,      # $13.50/host/yr
            "features": CORE_FEATURES + DEVOPS_ADDONS,
            "default_hosts": 10,
            "smart_features": [
                "Everything in Basic",
                "CI/CD pipeline management with approval gates",
                "Git repository integration",
                "Prometheus + Grafana monitoring",
                "Automated testing center",
                "Policy-as-code engine",
            ],
        },
        # ─── Standard ── $22.50/host/yr ────────────────────────
        "standard": {
            "label": "Standard",
            "description": "Enterprise essentials for up to 100 hosts",
            "price_mult": 2.5,      # $22.50/host/yr
            "features": CORE_FEATURES + STANDARD_ADDONS,
            "default_hosts": 100,
            "smart_features": [
                "Everything in Basic",
                "CVE tracking & remediation",
                "Compliance & SLA dashboards",
                "Windows patching & WSUS integration",
                "Role-based access control (RBAC)",
                "Audit trail & compliance reports (PDF/CSV)",
                "Software kiosk & fleet software distribution",
                "Local mirror repository",
                "Real-time notifications",
            ],
        },
        # ─── Standard + DevOps ── $27/host/yr ──────────────────
        "standard_devops": {
            "label": "Standard + DevOps",
            "description": "Standard + CI/CD & full DevOps pipeline (100 Hosts)",
            "price_mult": 3.0,      # $27.00/host/yr
            "features": CORE_FEATURES + STANDARD_ADDONS + DEVOPS_ADDONS + BACKUP_ADDONS,
            "default_hosts": 100,
            "smart_features": [
                "Everything in Standard",
                "Full CI/CD with multi-environment deployments",
                "Built-in backup scheduling (DB, file, VM)",
                "Ring-based progressive patch rollout",
                "Automated runbook execution",
                "Git-managed infrastructure policies",
            ],
        },
        # ─── Enterprise ── $45/host/yr ──────────────────────────
        "enterprise": {
            "label": "Enterprise",
            "description": "All features unlocked — unlimited hosts & scale",
            "price_mult": 5.0,      # $45.00/host/yr
            "features": ALL_FEATURES[:],
            "default_hosts": 0,     # 0 = unlimited
            "smart_features": [
                "Everything in Standard + DevOps",
                "Unlimited managed hosts",
                "Network PXE/iPXE boot provisioning",
                "Bare-metal managed relay rollout",
                "DR/SLA restore drills with RTO/RPO tracking",
                "LDAP / Active Directory SSO",
                "Live backup restore drills",
                "VM image provisioning & golden-image templates",
                "Dedicated support SLA",
                "Multi-site & HA deployment ready",
            ],
        },
    },
    fallback_factory=lambda key: {
        "label": str(key).replace("_", " ").title(),
        "description": "Legacy or custom tier imported from an existing vendor database.",
        "price_mult": 1.0,
        "features": [],
        "default_hosts": 0,
    },
)


# ── Database ───────────────────────────────────────────────────
class DatabaseWrapper:
    def __init__(self, conn):
        self.conn = conn
        self.conn.row_factory = sqlite3.Row
    def execute(self, query, params=()):
        cur = self.conn.cursor()
        cur.execute(query, params)
        return cur
    def executescript(self, script):
        cur = self.conn.cursor()
        cur.executescript(script)
    def commit(self):
        self.conn.commit()
    def close(self):
        self.conn.close()

def get_db():
    if "db" not in g:
        conn = sqlite3.connect(DATABASE_URL)
        g.db = DatabaseWrapper(conn)
        ensure_schema(g.db)
    return g.db


@app.teardown_appcontext
def close_db(exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()


@app.template_filter("from_json")
def from_json_filter(s):
    return safe_json_loads(s, [])


@app.context_processor
def inject_now():
    return {
        "now": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "portal_version": VERSION,
        "portal_name": "Vendor Portal",
    }


def ensure_table_columns(db, table_name, columns):
    existing = {row["name"] for row in db.execute(f"PRAGMA table_info({table_name})").fetchall()}
    for column_name, definition in columns.items():
        if column_name in existing:
            continue
        db.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")
        logger.info("Added missing vendor DB column %s.%s", table_name, column_name)


def ensure_schema(db):
    existing_tables = {
        row[0]
        for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    }
    required_tables = set(SCHEMA_COLUMNS)
    missing_tables = sorted(required_tables - existing_tables)
    if missing_tables:
        logger.warning(
            "Vendor DB at %s is missing tables %s; recreating schema now.",
            DATABASE_URL,
            ", ".join(missing_tables),
        )
        db.executescript(SCHEMA_SQL)
        existing_tables = {
            row[0]
            for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        }
    for table_name, columns in SCHEMA_COLUMNS.items():
        if table_name not in existing_tables:
            continue
        ensure_table_columns(db, table_name, columns)
    
    # Bootstrap default admin if first run
    _ensure_default_admin(db)
    
    db.commit()


def init_db():
    """Create tables if they don't exist."""
    conn = sqlite3.connect(DATABASE_URL)
    db = DatabaseWrapper(conn)
    ensure_schema(db)
    db.close()
    logger.info("Database initialized at %s", DATABASE_URL)

def log_activity(action, entity_type="", entity_id=None, details="", commit=True):
    db = get_db()
    db.execute(
        "INSERT INTO activity_log (action, entity_type, entity_id, details) VALUES (?,?,?,?)",
        (action, entity_type, entity_id, details),
    )
    if commit:
        db.commit()


def plan_requires_hw_id(plan):
    return PLANS.get(plan, {}).get("no_bind") is False


def redirect_to_next_or(next_url, fallback_endpoint, **fallback_values):
    if next_url and next_url.startswith("/") and not next_url.startswith("//"):
        return redirect(next_url)
    return redirect(url_for(fallback_endpoint, **fallback_values))


def _is_api_request() -> bool:
    return request.path.startswith("/api/")


@app.errorhandler(404)
def handle_not_found(error):
    if _is_api_request():
        return jsonify({"status": "error", "message": "Not found"}), 404
    return render_template(
        "error.html",
        status_code=404,
        title="Page Not Found",
        message="The page you requested does not exist or may have moved.",
    ), 404


@app.errorhandler(500)
def handle_internal_error(error):
    root = getattr(error, "original_exception", error)
    logger.exception("Unhandled vendor portal error on %s", request.path, exc_info=root)
    if _is_api_request():
        return jsonify({"status": "error", "message": "Internal server error"}), 500
    return render_template(
        "error.html",
        status_code=500,
        title="Something Went Wrong",
        message="Vendor Management hit an internal error. Please retry, and check service logs if it keeps happening.",
    ), 500


@app.route("/api/callbacks/activation", methods=["POST"])
def activation_callback():
    """Legacy-only activation callback. Manual vendor records are authoritative."""
    if not DEFAULT_ENABLE_ACTIVATION_CALLBACK:
        return jsonify({"status": "ignored", "message": "Activation callback is disabled by policy"}), 202

    data = request.get_json(silent=True) or {}
    license_id = data.get("license_id")
    hw_id = data.get("hw_id")
    
    if not license_id:
        return jsonify({"status": "error", "message": "Missing license_id"}), 400
        
    db = get_db()
    
    # Check if license exists
    lic = db.execute(
        "SELECT id, activated, hw_id, plan FROM licenses WHERE license_id = ?",
        (license_id,),
    ).fetchone()
    if not lic:
        return jsonify({"status": "error", "message": "License not found"}), 404

    bind_hw_id = plan_requires_hw_id(lic["plan"])

    if lic["activated"] == 1:
        # Keep testing/POC licenses portable; only persist hardware for bound plans.
        if bind_hw_id and not lic["hw_id"] and hw_id:
            db.execute("UPDATE licenses SET hw_id = ? WHERE id = ?", (hw_id, lic["id"]))
            db.commit()
        return jsonify({"status": "success", "message": "Already activated"})
        
    # Mark as activated
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    
    # Keep testing/POC licenses portable; only bind hardware for plans that require it.
    final_hw_id = lic["hw_id"] if bind_hw_id else ""
    if bind_hw_id and not final_hw_id and hw_id:
        final_hw_id = hw_id
        
    db.execute("""
        UPDATE licenses 
        SET activated = 1, activated_at = ?, hw_id = ?
        WHERE id = ?
    """, (now, final_hw_id, lic["id"]))
    
    log_activity("license_activated", "license", lic["id"], f"License {license_id} activated remotely (HW: {final_hw_id})")
    db.commit()
    
    return jsonify({"status": "success", "activated_at": now})


# ── License Generation ─────────────────────────────────────────
def generate_license_key(
    tier,
    plan,
    customer,
    max_hosts=None,
    hw_id="",
    sign_key=None,
    activation_url=None,
    private_key=None,
    public_key=None,
    encrypt_public_key=None,
):
    """Generate a signed PatchMaster license key. Returns (key, payload)."""
    sign_key, private_key, public_key = _resolve_signing_material(sign_key, private_key, public_key)
    encrypt_public_key = _resolve_encrypt_public_key(encrypt_public_key)
    plan_cfg = PLANS[plan]
    effective_tier = tier if tier in TIERS else "enterprise"
    if plan == "testing":
        effective_tier = "enterprise"
    no_bind = bool(plan_cfg.get("no_bind", True))
    hw_id = (hw_id or "").strip().lower()

    if not no_bind and not hw_id:
        raise RuntimeError("Hardware ID is required for bound/final licenses.")
    
    # Use tier default if max_hosts not provided
    if max_hosts is None:
        max_hosts = TIERS[effective_tier].get("default_hosts", 0)

    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=plan_cfg["days"])

    payload = {
        "v": 5 if encrypt_public_key else 4,
        "license_id": str(uuid.uuid4())[:8],
        "tier": effective_tier,
        "tier_label": TIERS[effective_tier]["label"],
        "features": TIERS[effective_tier]["features"],
        "plan": plan,
        "plan_label": f"{TIERS[effective_tier]['label']} ({plan_cfg['label']})",
        "customer": customer,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
        "issued_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "expires_at": expires.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "generated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "max_hosts": max_hosts,
        "hw_id": "" if no_bind else hw_id,
        "no_bind": no_bind,
        "binding_mode": "portable" if no_bind else "hardware_id",
        "version_compat": VERSION_COMPAT,
        "tool_version": TOOL_VERSION,
    }
    if activation_url:
        payload["activation_url"] = activation_url

    if encrypt_public_key:
        key, payload = _build_pm2_license(payload, sign_key, private_key, encrypt_public_key)
    else:
        payload_b64 = _encode_json_b64(payload)
        signature, payload["sig_alg"] = _sign_license_payload(payload_b64, sign_key, private_key)
        payload["license_format"] = "PM1"
        key = f"PM1-{payload_b64}.{signature}"
    return key, payload


# ── Auth ───────────────────────────────────────────────────────
# Legacy single-admin env vars kept for bootstrap only.
_LEGACY_ADMIN_USER = os.environ.get("CM_ADMIN_USER", "admin")
_LEGACY_ADMIN_PASS = os.environ.get("CM_ADMIN_PASS", "admin123")


def _hash_password(password: str) -> str:
    """SHA-256 + random salt, stored as salt:hash."""
    salt = secrets.token_hex(16)
    h = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}:{h}"


def _check_password(stored: str, provided: str) -> bool:
    if ":" not in stored:
        return False
    salt, h = stored.split(":", 1)
    return hmac.compare_digest(h, hashlib.sha256((salt + provided).encode()).hexdigest())


def _ensure_default_admin(db):
    """Create the default admin from env vars if no portal_users exist yet."""
    count = db.execute("SELECT COUNT(*) FROM portal_users").fetchone()[0]
    if count == 0:
        db.execute(
            "INSERT INTO portal_users (username, password_hash, role) VALUES (?,?,?)",
            (_LEGACY_ADMIN_USER, _hash_password(_LEGACY_ADMIN_PASS), "admin"),
        )
        db.commit()
        logger.info("Created default admin portal user '%s'", _LEGACY_ADMIN_USER)


def _get_portal_user(db, username: str):
    return db.execute("SELECT * FROM portal_users WHERE username=?", (username,)).fetchone()


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Decorator: requires logged-in user with role='admin'."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("login"))
        if session.get("role") != "admin":
            flash("Admin access required.", "danger")
            return redirect(url_for("dashboard"))
        return f(*args, **kwargs)
    return decorated


@app.route("/login", methods=["GET", "POST"])
@limiter.limit("12 per minute")  # brute-force protection
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        db = get_db()
        _ensure_default_admin(db)
        user = _get_portal_user(db, username)
        if user and user["is_active"] and _check_password(user["password_hash"], password):
            session["logged_in"] = True
            session["user"] = username
            session["role"] = user["role"]
            session["user_id"] = user["id"]
            session.permanent = True
            logger.info("Portal login: %s (%s) from %s", username, user["role"], request.remote_addr)
            flash("Logged in successfully.", "success")
            return redirect(url_for("dashboard"))
        logger.warning("Failed login for '%s' from %s", username, request.remote_addr)
        flash("Invalid credentials.", "danger")
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    flash("Logged out.", "info")
    return redirect(url_for("login"))


# ── Portal User Management ─────────────────────────────────────

@app.route("/users")
@admin_required
def users_list():
    db = get_db()
    users = db.execute("SELECT * FROM portal_users ORDER BY created_at DESC").fetchall()
    return render_template("users.html", users=users)


@app.route("/users/new", methods=["GET", "POST"])
@admin_required
def user_new():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()
        role = request.form.get("role", "viewer")
        if not username or not password:
            flash("Username and password are required.", "danger")
            return render_template("user_form.html", user=None)
        if role not in ("admin", "viewer"):
            role = "viewer"
        db = get_db()
        if db.execute("SELECT id FROM portal_users WHERE username=?", (username,)).fetchone():
            flash("Username already exists.", "danger")
            return render_template("user_form.html", user=None)
        db.execute(
            "INSERT INTO portal_users (username, password_hash, role) VALUES (?,?,?)",
            (username, _hash_password(password), role),
        )
        db.commit()
        log_activity("portal_user.created", "portal_user", None, f"Created portal user: {username} ({role})")
        flash(f"User '{username}' created.", "success")
        return redirect(url_for("users_list"))
    return render_template("user_form.html", user=None)


@app.route("/users/<int:uid>/edit", methods=["GET", "POST"])
@admin_required
def user_edit(uid):
    db = get_db()
    user = db.execute("SELECT * FROM portal_users WHERE id=?", (uid,)).fetchone()
    if not user:
        flash("User not found.", "danger")
        return redirect(url_for("users_list"))
    if request.method == "POST":
        role = request.form.get("role", "viewer")
        is_active = 1 if request.form.get("is_active") else 0
        if role not in ("admin", "viewer"):
            role = "viewer"
        # Prevent removing the last admin
        if role != "admin" or not is_active:
            admin_count = db.execute(
                "SELECT COUNT(*) FROM portal_users WHERE role='admin' AND is_active=1 AND id!=?", (uid,)
            ).fetchone()[0]
            if admin_count == 0:
                flash("Cannot demote or deactivate the last active admin.", "danger")
                return render_template("user_form.html", user=user)
        db.execute(
            "UPDATE portal_users SET role=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (role, is_active, uid),
        )
        db.commit()
        log_activity("portal_user.updated", "portal_user", uid,
                     f"Updated portal user: {user['username']} role={role} active={is_active}")
        flash("User updated.", "success")
        return redirect(url_for("users_list"))
    return render_template("user_form.html", user=user)


@app.route("/users/<int:uid>/delete", methods=["POST"])
@admin_required
def user_delete(uid):
    db = get_db()
    user = db.execute("SELECT * FROM portal_users WHERE id=?", (uid,)).fetchone()
    if not user:
        flash("User not found.", "danger")
        return redirect(url_for("users_list"))
    if user["id"] == session.get("user_id"):
        flash("You cannot delete your own account.", "danger")
        return redirect(url_for("users_list"))
    # Prevent deleting the last admin
    if user["role"] == "admin":
        admin_count = db.execute(
            "SELECT COUNT(*) FROM portal_users WHERE role='admin' AND is_active=1 AND id!=?", (uid,)
        ).fetchone()[0]
        if admin_count == 0:
            flash("Cannot delete the last active admin.", "danger")
            return redirect(url_for("users_list"))
    db.execute("DELETE FROM portal_users WHERE id=?", (uid,))
    db.commit()
    log_activity("portal_user.deleted", "portal_user", uid, f"Deleted portal user: {user['username']}")
    flash(f"User '{user['username']}' deleted.", "warning")
    return redirect(url_for("users_list"))


@app.route("/users/change-password", methods=["GET", "POST"])
@login_required
def change_password():
    if request.method == "POST":
        current = request.form.get("current_password", "")
        new_pw = request.form.get("new_password", "").strip()
        confirm = request.form.get("confirm_password", "").strip()
        if not new_pw or len(new_pw) < 6:
            flash("New password must be at least 6 characters.", "danger")
            return render_template("change_password.html")
        if new_pw != confirm:
            flash("New passwords do not match.", "danger")
            return render_template("change_password.html")
        db = get_db()
        user = db.execute("SELECT * FROM portal_users WHERE id=?", (session["user_id"],)).fetchone()
        if not user or not _check_password(user["password_hash"], current):
            flash("Current password is incorrect.", "danger")
            return render_template("change_password.html")
        db.execute(
            "UPDATE portal_users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (_hash_password(new_pw), session["user_id"]),
        )
        db.commit()
        log_activity("portal_user.password_changed", "portal_user", session["user_id"],
                     f"Password changed for: {session['user']}")
        flash("Password changed successfully.", "success")
        return redirect(url_for("dashboard"))
    return render_template("change_password.html")


# ── Deleted Customers ──────────────────────────────────────────

@app.route("/customers/deleted")
@login_required
def deleted_customers():
    db = get_db()
    rows = db.execute("""
        SELECT c.*,
               COUNT(DISTINCT l.id) as license_count
        FROM customers c
        LEFT JOIN licenses l ON c.id = l.customer_id
        WHERE c.status = 'deleted'
        GROUP BY c.id
        ORDER BY c.updated_at DESC
    """).fetchall()
    # Fetch licenses for each deleted customer
    customer_licenses = {}
    for row in rows:
        lics = db.execute("""
            SELECT license_id, tier, plan, expires_at, is_revoked, issued_at
            FROM licenses WHERE customer_id=? ORDER BY created_at DESC
        """, (row["id"],)).fetchall()
        customer_licenses[row["id"]] = lics
    return render_template("deleted_customers.html", customers=rows,
                           customer_licenses=customer_licenses, tiers=TIERS, plans=PLANS)
    return redirect(url_for("login"))


# ── Dashboard ──────────────────────────────────────────────────
@app.route("/")
@login_required
def dashboard():
    db = get_db()
    stats = {
        "total_customers": db.execute("SELECT COUNT(*) FROM customers").fetchone()[0],
        "active_customers": db.execute("SELECT COUNT(*) FROM customers WHERE status='active'").fetchone()[0],
        "total_purchases": db.execute("SELECT COUNT(*) FROM purchases").fetchone()[0],
        "total_revenue": db.execute("SELECT COALESCE(SUM(amount),0) FROM purchases WHERE status='completed'").fetchone()[0],
        "total_licenses": db.execute("SELECT COUNT(*) FROM licenses").fetchone()[0],
        "active_licenses": db.execute("SELECT COUNT(*) FROM licenses WHERE is_revoked=0 AND expires_at > CURRENT_TIMESTAMP").fetchone()[0],
        "expired_licenses": db.execute("SELECT COUNT(*) FROM licenses WHERE is_revoked=0 AND expires_at <= CURRENT_TIMESTAMP").fetchone()[0],
        "revoked_licenses": db.execute("SELECT COUNT(*) FROM licenses WHERE is_revoked=1").fetchone()[0],
    }
    tier_dist = db.execute(
        "SELECT tier, COUNT(*) as cnt FROM licenses WHERE is_revoked=0 GROUP BY tier"
    ).fetchall()
    recent = db.execute(
        "SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 15"
    ).fetchall()
    recent_purchases = db.execute("""
        SELECT p.*, c.name as customer_name, c.company
        FROM purchases p JOIN customers c ON p.customer_id = c.id
        ORDER BY p.purchased_at DESC LIMIT 10
    """).fetchall()
    return render_template("dashboard.html", stats=stats, tier_dist=tier_dist,
                           recent=recent, recent_purchases=recent_purchases,
                           tiers=TIERS, plans=PLANS)


# ── Customers ──────────────────────────────────────────────────
@app.route("/customers")
@login_required
def customers_list():
    db = get_db()
    search = request.args.get("q", "").strip()
    status_filter = request.args.get("status", "")
    query = """
        SELECT c.*,
               COUNT(DISTINCT p.id) as purchase_count,
               COUNT(DISTINCT l.id) as license_count,
               COALESCE(SUM(p.amount), 0) as total_spent
        FROM customers c
        LEFT JOIN purchases p ON c.id = p.customer_id
        LEFT JOIN licenses l ON c.id = l.customer_id AND l.is_revoked = 0
    """
    params = []
    wheres = []
    if search:
        wheres.append("(c.name LIKE ? OR c.email LIKE ? OR c.company LIKE ?)")
        params.extend([f"%{search}%"] * 3)
    if status_filter:
        wheres.append("c.status = ?")
        params.append(status_filter)
    else:
        # Hide soft-deleted customers from the default view
        wheres.append("c.status != 'deleted'")
    if wheres:
        query += " WHERE " + " AND ".join(wheres)
    query += " GROUP BY c.id ORDER BY c.created_at DESC"
    customers = db.execute(query, params).fetchall()
    return render_template("customers.html", customers=customers, search=search,
                           status_filter=status_filter)


@app.route("/customers/new", methods=["GET", "POST"])
@login_required
def customer_new():
    if request.method == "POST":
        db = get_db()
        db.execute(
            "INSERT INTO customers (name, email, company, phone, address, notes) VALUES (?,?,?,?,?,?)",
            (
                request.form["name"].strip(),
                request.form["email"].strip(),
                request.form.get("company", "").strip(),
                request.form.get("phone", "").strip(),
                request.form.get("address", "").strip(),
                request.form.get("notes", "").strip(),
            ),
        )
        db.commit()
        cust_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
        log_activity("customer.created", "customer", cust_id,
                     f"Created customer: {request.form['name'].strip()}")
        flash("Customer created successfully.", "success")
        return redirect(url_for("customer_detail", cid=cust_id))
    return render_template("customer_form.html", customer=None, tiers=TIERS, plans=PLANS)


@app.route("/customers/<int:cid>")
@login_required
def customer_detail(cid):
    db = get_db()
    customer = db.execute("SELECT * FROM customers WHERE id = ?", (cid,)).fetchone()
    if not customer:
        flash("Customer not found.", "danger")
        return redirect(url_for("customers_list"))
    purchases = db.execute(
        "SELECT * FROM purchases WHERE customer_id = ? ORDER BY purchased_at DESC", (cid,)
    ).fetchall()
    licenses = db.execute(
        "SELECT * FROM licenses WHERE customer_id = ? ORDER BY created_at DESC", (cid,)
    ).fetchall()
    licensed_purchase_ids = {row["purchase_id"] for row in licenses if row["purchase_id"]}
    return render_template("customer_detail.html", customer=customer,
                           purchases=purchases, licenses=licenses,
                           tiers=TIERS, plans=PLANS,
                           licensed_purchase_ids=licensed_purchase_ids)


@app.route("/customers/<int:cid>/delete", methods=["POST"])
@login_required
def customer_delete(cid):
    """Soft-delete a customer.

    The customer row is marked deleted=1 so it no longer appears in normal
    lists, but all license rows are intentionally left intact.  Because
    licenses are self-contained signed JWTs, any already-issued key continues
    to validate on the product side until its own expiry date — deletion here
    only removes the customer from the vendor portal UI.
    """
    db = get_db()
    customer = db.execute("SELECT * FROM customers WHERE id=?", (cid,)).fetchone()
    if not customer:
        flash("Customer not found.", "danger")
        return redirect(url_for("customers_list"))
    db.execute(
        "UPDATE customers SET status='deleted', updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (cid,),
    )
    db.commit()
    log_activity("customer.deleted", "customer", cid,
                 f"Soft-deleted customer: {customer['name']} — existing licenses remain valid until expiry")
    logger.info("Customer %s (id=%s) soft-deleted; licenses untouched", customer["name"], cid)
    flash(
        f"Customer '{customer['name']}' deleted. "
        "Existing license keys remain valid until their expiry date.",
        "warning",
    )
    return redirect(url_for("customers_list"))


@app.route("/customers/<int:cid>/edit", methods=["GET", "POST"])
@login_required
def customer_edit(cid):
    db = get_db()
    customer = db.execute("SELECT * FROM customers WHERE id = ?", (cid,)).fetchone()
    if not customer:
        flash("Customer not found.", "danger")
        return redirect(url_for("customers_list"))
    if request.method == "POST":
        db.execute("""
            UPDATE customers SET name=?, email=?, company=?, phone=?, address=?,
                   notes=?, status=?, updated_at=CURRENT_TIMESTAMP
            WHERE id=?
        """, (
            request.form["name"].strip(),
            request.form["email"].strip(),
            request.form.get("company", "").strip(),
            request.form.get("phone", "").strip(),
            request.form.get("address", "").strip(),
            request.form.get("notes", "").strip(),
            request.form.get("status", "active"),
            cid,
        ))
        db.commit()
        log_activity("customer.updated", "customer", cid,
                     f"Updated customer: {request.form['name'].strip()}")
        flash("Customer updated.", "success")
        return redirect(url_for("customer_detail", cid=cid))
    return render_template("customer_form.html", customer=customer, tiers=TIERS, plans=PLANS)


# ── Purchases ──────────────────────────────────────────────────
@app.route("/purchases")
@login_required
def purchases_list():
    db = get_db()
    tier_filter = request.args.get("tier", "")
    plan_filter = request.args.get("plan", "")
    query = """
        SELECT p.*, c.name as customer_name, c.company
        FROM purchases p JOIN customers c ON p.customer_id = c.id
    """
    params = []
    wheres = []
    if tier_filter:
        wheres.append("p.tier = ?")
        params.append(tier_filter)
    if plan_filter:
        wheres.append("p.plan = ?")
        params.append(plan_filter)
    if wheres:
        query += " WHERE " + " AND ".join(wheres)
    query += " ORDER BY p.purchased_at DESC"
    purchases = db.execute(query, params).fetchall()
    purchase_ids = [row["id"] for row in purchases]
    licensed_purchase_ids = set()
    if purchase_ids:
        placeholders = ",".join("?" for _ in purchase_ids)
        licensed_purchase_ids = {
            row[0]
            for row in db.execute(
                f"SELECT DISTINCT purchase_id FROM licenses WHERE purchase_id IN ({placeholders})",
                purchase_ids,
            ).fetchall()
        }
    return render_template("purchases.html", purchases=purchases, tiers=TIERS,
                           plans=PLANS, tier_filter=tier_filter, plan_filter=plan_filter,
                           licensed_purchase_ids=licensed_purchase_ids)


@app.route("/purchases/new", methods=["GET", "POST"])
@login_required
def purchase_new():
    db = get_db()
    if request.method == "POST":
        customer_id = parse_int_field(request.form.get("customer_id"))
        tier = request.form.get("tier", "").strip()
        plan = request.form.get("plan", "").strip()
        max_hosts_raw = request.form.get("max_hosts", "").strip()
        max_hosts = parse_int_field(max_hosts_raw, 0) if max_hosts_raw else None
        hw_id = request.form.get("hw_id", "").strip().lower()
        amount_raw = request.form.get("amount", "").strip()
        try:
            amount = float(amount_raw) if amount_raw else 0.0
        except ValueError:
            amount = 0.0
        payment_method = request.form.get("payment_method", "").strip()
        payment_ref = request.form.get("payment_ref", "").strip()
        notes = request.form.get("notes", "").strip()

        if customer_id <= 0:
            flash("Select a valid customer before creating a purchase.", "danger")
            return redirect(url_for("purchase_new"))

        customer = db.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
        if not customer:
            flash("Customer not found.", "danger")
            return redirect(url_for("purchase_new"))
        if tier not in TIERS or plan not in PLANS:
            flash("Invalid tier or plan.", "danger")
            return redirect(url_for("purchase_new"))
        if plan_requires_hw_id(plan) and not hw_id:
            flash("Hardware MAC ID is required for this plan before generating the license.", "danger")
            return redirect(url_for("purchase_new", cid=customer_id))

        try:
            db.execute("BEGIN")
            effective_max_hosts = TIERS[tier].get("default_hosts", 0) if max_hosts is None else max_hosts
            db.execute("""
                INSERT INTO purchases (customer_id, tier, plan, max_hosts, amount,
                                       currency, payment_method, payment_ref, notes)
                VALUES (?,?,?,?,?,?,?,?,?)
            """, (customer_id, tier, plan, effective_max_hosts, amount, "USD",
                  payment_method, payment_ref, notes))
            purchase_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]

            key, payload = generate_license_key(tier, plan, customer["name"], max_hosts, hw_id=hw_id)
            db.execute("""
                INSERT INTO licenses (purchase_id, customer_id, license_id, license_key,
                                      tier, plan, features, max_hosts, hw_id, tool_version,
                                      version_compat, issued_at, expires_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                purchase_id, customer_id, payload["license_id"], key,
                payload["tier"], plan, json.dumps(payload["features"]),
                payload["max_hosts"], payload.get("hw_id", ""), TOOL_VERSION, VERSION_COMPAT,
                payload["issued_at"], payload["expires_at"],
            ))

            log_activity(
                "purchase.created",
                "purchase",
                purchase_id,
                f"{customer['name']} - {TIERS[tier]['label']} / {PLANS[plan]['label']} (${amount})",
                commit=False,
            )
            log_activity(
                "license.generated",
                "license",
                None,
                f"License {payload['license_id']} for {customer['name']}",
                commit=False,
            )
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("Failed to create purchase/license for customer %s", customer_id)
            flash("Purchase could not be completed. No license was generated; please retry.", "danger")
            return redirect(url_for("purchase_new", cid=customer_id))

        flash(f"Purchase recorded & license generated (ID: {payload['license_id']}).", "success")
        return redirect(url_for("customer_detail", cid=customer_id))

    customers = db.execute("SELECT id, name, company FROM customers WHERE status='active' ORDER BY name").fetchall()
    return render_template("purchase_form.html", customers=customers, tiers=TIERS, plans=PLANS)


@app.route("/licenses/generate/<int:purchase_id>", methods=["POST"])
@login_required
def generate_license_for_purchase(purchase_id):
    db = get_db()
    next_url = request.form.get("next", "").strip()
    purchase = db.execute("""
        SELECT p.*, c.name as customer_name
        FROM purchases p
        JOIN customers c ON p.customer_id = c.id
        WHERE p.id = ?
    """, (purchase_id,)).fetchone()

    if not purchase:
        flash("Purchase not found.", "danger")
        return redirect(url_for("purchases_list"))

    existing = db.execute("SELECT id FROM licenses WHERE purchase_id = ?", (purchase_id,)).fetchone()
    if existing:
        flash("License already exists for this purchase.", "warning")
        return redirect(url_for("license_detail", lid=existing[0]))

    hw_id = request.form.get("hw_id", "").strip().lower()
    if plan_requires_hw_id(purchase["plan"]) and not hw_id:
        flash("Hardware MAC ID is required to generate a license for this plan.", "danger")
        return redirect_to_next_or(next_url, "customer_detail", cid=purchase["customer_id"])

    try:
        db.execute("BEGIN")
        key, payload = generate_license_key(
            tier=purchase["tier"],
            plan=purchase["plan"],
            customer=purchase["customer_name"],
            max_hosts=purchase["max_hosts"],
            hw_id=hw_id,
        )

        db.execute("""
            INSERT INTO licenses (
                purchase_id, customer_id, license_id, license_key, tier, plan, features,
                max_hosts, tool_version, version_compat, hw_id, issued_at, expires_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            purchase["id"],
            purchase["customer_id"],
            payload["license_id"],
            key,
            payload["tier"],
            payload["plan"],
            json.dumps(payload["features"]),
            payload["max_hosts"],
            payload["tool_version"],
            payload["version_compat"],
            payload.get("hw_id", ""),
            payload["issued_at"],
            payload["expires_at"],
        ))

        log_activity(
            "generate_license",
            "license",
            None,
            f"Generated license {payload['license_id']} for {purchase['customer_name']}",
            commit=False,
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to generate recovery license for purchase %s", purchase_id)
        flash("License generation failed for this purchase. Please retry.", "danger")
        return redirect_to_next_or(next_url, "customer_detail", cid=purchase["customer_id"])

    flash("License generated successfully.", "success")
    return redirect_to_next_or(next_url, "purchases_list")


# Licenses ───────────────────────────────────────────────────
@app.route("/licenses")
@login_required
def licenses_list():
    db = get_db()
    status_filter = request.args.get("status", "")
    tier_filter = request.args.get("tier", "")
    query = """
        SELECT l.*, c.name as customer_name, c.company
        FROM licenses l JOIN customers c ON l.customer_id = c.id
    """
    params = []
    wheres = []
    if status_filter == "active":
        wheres.append("l.is_revoked = 0 AND l.expires_at > CURRENT_TIMESTAMP")
    elif status_filter == "expired":
        wheres.append("l.is_revoked = 0 AND l.expires_at <= CURRENT_TIMESTAMP")
    elif status_filter == "revoked":
        wheres.append("l.is_revoked = 1")
    if tier_filter:
        wheres.append("l.tier = ?")
        params.append(tier_filter)
    if wheres:
        query += " WHERE " + " AND ".join(wheres)
    query += " ORDER BY l.created_at DESC"
    licenses = db.execute(query, params).fetchall()
    return render_template("licenses.html", licenses=licenses, tiers=TIERS,
                           status_filter=status_filter, tier_filter=tier_filter)


@app.route("/licenses/<int:lid>")
@login_required
def license_detail(lid):
    db = get_db()
    lic = db.execute("""
        SELECT l.*, c.name as customer_name, c.company, c.email as customer_email
        FROM licenses l JOIN customers c ON l.customer_id = c.id
        WHERE l.id = ?
    """, (lid,)).fetchone()
    if not lic:
        flash("License not found.", "danger")
        return redirect(url_for("licenses_list"))
    features = safe_json_loads(lic["features"], [])
    return render_template("license_detail.html", lic=lic, features=features, tiers=TIERS)


@app.route("/licenses/<int:lid>/revoke", methods=["POST"])
@login_required
def license_revoke(lid):
    db = get_db()
    reason = request.form.get("reason", "").strip()
    db.execute("""
        UPDATE licenses SET is_revoked=1, revoked_at=CURRENT_TIMESTAMP, revoke_reason=?
        WHERE id=?
    """, (reason, lid))
    db.commit()
    lic = db.execute("SELECT license_id, customer_id FROM licenses WHERE id=?", (lid,)).fetchone()
    if not lic:
        flash("License not found.", "danger")
        return redirect(url_for("licenses_list"))
    log_activity("license.revoked", "license", lid,
                 f"License {lic['license_id']} revoked: {reason}")
    logger.info("License %s revoked: %s", lic["license_id"], reason)
    flash("License revoked.", "warning")
    return redirect(url_for("license_detail", lid=lid))


@app.route("/licenses/<int:lid>/copy-key")
@login_required
def license_copy_key(lid):
    db = get_db()
    lic = db.execute("SELECT license_key FROM licenses WHERE id=?", (lid,)).fetchone()
    if lic:
        return jsonify({"key": lic["license_key"]})
    return jsonify({"error": "Not found"}), 404


@app.route("/licenses/<int:lid>/regenerate", methods=["POST"])
@login_required
def license_regenerate(lid):
    db = get_db()
    old = db.execute("""
        SELECT l.*, c.name as customer_name
        FROM licenses l JOIN customers c ON l.customer_id = c.id
        WHERE l.id = ?
    """, (lid,)).fetchone()
    if not old:
        flash("License not found.", "danger")
        return redirect(url_for("licenses_list"))

    db.execute("UPDATE licenses SET is_revoked=1, revoked_at=CURRENT_TIMESTAMP, revoke_reason='Regenerated' WHERE id=?", (lid,))

    key, payload = generate_license_key(old["tier"], old["plan"], old["customer_name"], old["max_hosts"], hw_id=old["hw_id"])
    db.execute("""
        INSERT INTO licenses (purchase_id, customer_id, license_id, license_key,
                              tier, plan, features, max_hosts, hw_id, tool_version,
                              version_compat, issued_at, expires_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        old["purchase_id"], old["customer_id"], payload["license_id"], key,
        payload["tier"], old["plan"], json.dumps(payload["features"]),
        old["max_hosts"], old["hw_id"], TOOL_VERSION, VERSION_COMPAT,
        payload["issued_at"], payload["expires_at"],
    ))
    db.commit()
    new_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    log_activity("license.regenerated", "license", new_id,
                 f"Regenerated from {old['license_id']} → {payload['license_id']}")
    logger.info("License regenerated: %s → %s", old["license_id"], payload["license_id"])
    flash(f"New license generated (ID: {payload['license_id']}). Old key revoked.", "success")
    return redirect(url_for("license_detail", lid=new_id))


# ── Tool Versions ──────────────────────────────────────────────
@app.route("/versions")
@login_required
def versions_list():
    db = get_db()
    versions = db.execute("SELECT * FROM tool_versions ORDER BY release_date DESC").fetchall()
    return render_template("versions.html", versions=versions, tiers=TIERS)


@app.route("/versions/new", methods=["GET", "POST"])
@login_required
def version_new():
    if request.method == "POST":
        db = get_db()
        version = request.form["version"].strip()
        is_latest = 1 if request.form.get("is_latest") else 0
        if is_latest:
            db.execute("UPDATE tool_versions SET is_latest=0")
        db.execute("""
            INSERT INTO tool_versions (version, codename, release_date, changelog,
                                       min_tier, is_latest, download_url, file_hash)
            VALUES (?,?,?,?,?,?,?,?)
        """, (
            version,
            request.form.get("codename", "").strip(),
            request.form["release_date"].strip(),
            request.form.get("changelog", "").strip(),
            request.form.get("min_tier", "basic"),
            is_latest,
            request.form.get("download_url", "").strip(),
            request.form.get("file_hash", "").strip(),
        ))
        db.commit()
        log_activity("version.created", "version", None, f"Version {version} added")
        flash(f"Version {version} added.", "success")
        return redirect(url_for("versions_list"))
    return render_template("version_form.html", version=None, tiers=TIERS)


@app.route("/versions/<int:vid>/edit", methods=["GET", "POST"])
@login_required
def version_edit(vid):
    db = get_db()
    ver = db.execute("SELECT * FROM tool_versions WHERE id=?", (vid,)).fetchone()
    if not ver:
        flash("Version not found.", "danger")
        return redirect(url_for("versions_list"))
    if request.method == "POST":
        is_latest = 1 if request.form.get("is_latest") else 0
        if is_latest:
            db.execute("UPDATE tool_versions SET is_latest=0")
        db.execute("""
            UPDATE tool_versions SET version=?, codename=?, release_date=?, changelog=?,
                   min_tier=?, is_latest=?, download_url=?, file_hash=?
            WHERE id=?
        """, (
            request.form["version"].strip(),
            request.form.get("codename", "").strip(),
            request.form["release_date"].strip(),
            request.form.get("changelog", "").strip(),
            request.form.get("min_tier", "basic"),
            is_latest,
            request.form.get("download_url", "").strip(),
            request.form.get("file_hash", "").strip(),
            vid,
        ))
        db.commit()
        flash("Version updated.", "success")
        return redirect(url_for("versions_list"))
    return render_template("version_form.html", version=ver, tiers=TIERS)


# ── Activity Log ───────────────────────────────────────────────
@app.route("/activity")
@login_required
def activity_log():
    db = get_db()
    logs = db.execute("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 200").fetchall()
    return render_template("activity.html", logs=logs)


# ── Reports / Analytics ───────────────────────────────────────
@app.route("/reports")
@login_required
def reports():
    db = get_db()
    revenue_monthly = db.execute("""
        SELECT strftime('%Y-%m', purchased_at) as month, SUM(amount) as total
        FROM purchases WHERE status='completed'
        GROUP BY month ORDER BY month DESC LIMIT 12
    """).fetchall()
    revenue_tier = db.execute("""
        SELECT tier, SUM(amount) as total, COUNT(*) as cnt
        FROM purchases WHERE status='completed'
        GROUP BY tier
    """).fetchall()
    lic_active = db.execute("SELECT COUNT(*) FROM licenses WHERE is_revoked=0 AND expires_at > CURRENT_TIMESTAMP").fetchone()[0]
    lic_expired = db.execute("SELECT COUNT(*) FROM licenses WHERE is_revoked=0 AND expires_at <= CURRENT_TIMESTAMP").fetchone()[0]
    lic_revoked = db.execute("SELECT COUNT(*) FROM licenses WHERE is_revoked=1").fetchone()[0]
    expiring = db.execute("""
        SELECT l.*, c.name as customer_name, c.company
        FROM licenses l JOIN customers c ON l.customer_id = c.id
        WHERE l.is_revoked=0 AND l.expires_at > CURRENT_TIMESTAMP
          AND l.expires_at <= datetime('now', '+30 days')
        ORDER BY l.expires_at ASC
    """).fetchall()
    return render_template("reports.html",
                           revenue_monthly=revenue_monthly, revenue_tier=revenue_tier,
                           lic_active=lic_active, lic_expired=lic_expired,
                           lic_revoked=lic_revoked, expiring=expiring,
                           tiers=TIERS, plans=PLANS)


# ── API ────────────────────────────────────────────────────────
@app.route("/api/stats")
@login_required
def api_stats():
    db = get_db()
    return jsonify({
        "customers": db.execute("SELECT COUNT(*) FROM customers").fetchone()[0],
        "purchases": db.execute("SELECT COUNT(*) FROM purchases").fetchone()[0],
        "licenses": db.execute("SELECT COUNT(*) FROM licenses").fetchone()[0],
        "active_licenses": db.execute(
            "SELECT COUNT(*) FROM licenses WHERE is_revoked=0 AND expires_at > CURRENT_TIMESTAMP"
        ).fetchone()[0],
        "revenue": db.execute("SELECT COALESCE(SUM(amount),0) FROM purchases WHERE status='completed'").fetchone()[0],
    })


@app.route("/api/version/latest")
def api_latest_version():
    """Public API for tools to check for updates."""
    db = get_db()
    ver = db.execute(
        "SELECT version, codename, release_date, changelog, download_url FROM tool_versions WHERE is_latest=1"
    ).fetchone()
    if not ver:
        return jsonify({"version": None})
    return jsonify({
        "version": ver["version"],
        "codename": ver["codename"],
        "release_date": ver["release_date"],
        "changelog": ver["changelog"],
        "download_url": ver["download_url"],
    })


@app.route("/api/health")
def api_health():
    """Health check endpoint (no auth required)."""
    try:
        conn = sqlite3.connect(DATABASE_URL)
        db = DatabaseWrapper(conn)
        ensure_schema(db)
        db.close()
        return jsonify({"status": "healthy", "service": "vendor-portal"})
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 503


# ── Main ───────────────────────────────────────────────────────
init_db()  # Ensure tables exist on startup (even via Gunicorn)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="PatchMaster Vendor Portal")
    parser.add_argument("--port", type=int, default=int(os.environ.get("CM_PORT", 5050)))
    parser.add_argument("--host", default=os.environ.get("CM_HOST", "127.0.0.1"))
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    print(f"\n  PatchMaster Vendor Portal")
    print(f"  http://{args.host}:{args.port}")
    admin_user = os.environ.get("CM_ADMIN_USER", "admin")
    admin_pass = os.environ.get("CM_ADMIN_PASS", "")
    print(f"  Login: {admin_user} / {'*' * len(admin_pass) if admin_pass else '<No Password set>'}\n")
    app.run(host=args.host, port=args.port, debug=args.debug)
