#!/usr/bin/env python3
"""
PatchMaster — CLI License Key Generator
Standalone tool for generating license keys from the command line.
Can be used independently or alongside the Vendor Portal.

Usage:
    python generate-license.py --plan testing --customer "Demo User"
    (Testing licenses last 30 days; regenerating reuses remaining days for that customer.)
"""
import argparse
import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import sys
import uuid
from datetime import datetime, timedelta, timezone

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

PLACEHOLDER_VALUES = {
    "",
    "change-me",
    "replace-me",
    "PatchMaster-License-SignKey-2026-Secure",
    "changeme-set-a-strong-random-secret-here",
}


def _is_placeholder_value(value: str) -> bool:
    value = (value or "").strip()
    if value in PLACEHOLDER_VALUES:
        return True
    lowered = value.lower()
    return lowered.startswith("changeme-") or lowered.startswith("replace-me")


def _read_env_value_from_file(path: str, key: str) -> str:
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


def _load_setting(key: str) -> str:
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


DEFAULT_SIGN_KEY = _load_setting("LICENSE_SIGN_KEY")
DEFAULT_SIGN_PRIVATE_KEY = _load_setting("LICENSE_SIGN_PRIVATE_KEY")
DEFAULT_VERIFY_PUBLIC_KEY = _load_setting("LICENSE_VERIFY_PUBLIC_KEY")
DEFAULT_ENCRYPT_PUBLIC_KEY = _load_setting("LICENSE_ENCRYPT_PUBLIC_KEY")

# PM2 (encrypted) licenses are required
if not DEFAULT_SIGN_PRIVATE_KEY:
    raise RuntimeError(
        "LICENSE_SIGN_PRIVATE_KEY is required for PM2 license generation. "
        "Run: python generate-pm2-keys.py to generate keys."
    )
if not DEFAULT_ENCRYPT_PUBLIC_KEY:
    raise RuntimeError(
        "LICENSE_ENCRYPT_PUBLIC_KEY is required for PM2 license generation. "
        "Run: python generate-pm2-keys.py to generate keys."
    )
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "customers.db")

PLANS = {
    "testing": {"days": 30, "label": "Testing (30 Days)", "no_bind": True},
    "poc":     {"days": 14, "label": "POC (14 Days)", "no_bind": True},
    "trial":   {"days": 45, "label": "Trial (45 Days)", "no_bind": False},
}

CORE_FEATURES = [
    "dashboard", "hosts", "groups", "patches", "snapshots",
    "compare", "offline", "schedules", "jobs", "onboarding", "settings", "license",
]

ALL_FEATURES = [
    "dashboard", "compliance", "hosts", "groups", "patches",
    "snapshots", "compare", "offline", "schedules", "cve",
    "jobs", "audit", "notifications", "users", "license",
    "cicd", "git", "onboarding", "settings", "monitoring", "testing",
    "local-repo", "software", "policies", "reports",
    "backup_db", "backup_file", "backup_vm", "backup_live",
    "backups", "linux_patching", "windows_patching", "wsus",
]

STANDARD_ADDONS = [
    "compliance", "cve", "audit", "notifications", "users", "local-repo",
    "monitoring", "wsus", "reports", "software", "windows_patching",
]
DEVOPS_ADDONS = ["cicd", "git", "monitoring", "testing", "policies"]

TIERS = {
    "basic": {
        "label": "Basic",
        "description": "Core Patching (10 Hosts)",
        "features": CORE_FEATURES + ["linux_patching"],
        "default_hosts": 10,
    },
    "basic_devops": {
        "label": "Basic + DevOps",
        "description": "Basic + CI/CD & Monitoring (10 Hosts)",
        "features": CORE_FEATURES + ["linux_patching"] + DEVOPS_ADDONS,
        "default_hosts": 10,
    },
    "standard": {
        "label": "Standard",
        "description": "Enterprise Essentials (100 Hosts)",
        "features": CORE_FEATURES + ["linux_patching"] + STANDARD_ADDONS,
        "default_hosts": 100,
    },
    "standard_devops": {
        "label": "Standard + DevOps",
        "description": "Standard + CI/CD & Monitoring (100 Hosts)",
        "features": CORE_FEATURES + ["linux_patching"] + STANDARD_ADDONS + DEVOPS_ADDONS + ["backup_db", "backup_file", "backups"],
        "default_hosts": 100,
    },
    "enterprise": {
        "label": "Enterprise (Advance)",
        "description": "All Features Enabled (Unlimited Hosts)",
        "features": ALL_FEATURES[:],
        "default_hosts": 0,
    },
}

TOOL_VERSION = "2.0"
VERSION_COMPAT = "2.x"


def _decode_key_bytes(value: str) -> bytes:
    text = (value or "").strip()
    if not text:
        return b""
    padding = "=" * ((4 - len(text) % 4) % 4)
    try:
        return base64.urlsafe_b64decode((text + padding).encode())
    except Exception:
        return b""


def _derive_public_key(private_key: str) -> str:
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


def _resolve_signing_material(sign_key: str = "", private_key: str = "", public_key: str = "") -> tuple[str, str, str]:
    resolved_private = (private_key or DEFAULT_SIGN_PRIVATE_KEY or "").strip()
    resolved_sign = (sign_key or DEFAULT_SIGN_KEY or "").strip()
    resolved_public = (public_key or DEFAULT_VERIFY_PUBLIC_KEY or "").strip()
    if resolved_private and not resolved_public:
        resolved_public = _derive_public_key(resolved_private)
    return resolved_sign, resolved_private, resolved_public


def _resolve_encrypt_public_key(encrypt_public_key: str = "") -> str:
    return (encrypt_public_key or DEFAULT_ENCRYPT_PUBLIC_KEY or "").strip()


def _sign_license_payload(message: str, sign_key: str, private_key: str) -> tuple[str, str]:
    if private_key:
        private_bytes = _decode_key_bytes(private_key)
        signer = Ed25519PrivateKey.from_private_bytes(private_bytes)
        signature = signer.sign(message.encode()).hex()
        return signature, "ed25519"

    if not sign_key:
        raise RuntimeError("No signing secret or private key is configured for license generation.")
    signature = hmac.new(sign_key.encode(), message.encode(), hashlib.sha256).hexdigest()
    return signature, "hmac-sha256"


def _derive_pm2_aead_key(shared_secret: bytes) -> bytes:
    return HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=b"patchmaster-pm2-license-v1",
    ).derive(shared_secret)


def _encode_json_b64(value: dict) -> str:
    return base64.urlsafe_b64encode(
        json.dumps(value, separators=(",", ":")).encode()
    ).decode().rstrip("=")


def _build_pm2_license(payload: dict, sign_key: str, private_key: str, encrypt_public_key: str) -> tuple[str, dict]:
    header = {
        "v": 5,
        "license_id": payload["license_id"],
        "sig_alg": "ed25519" if private_key else "hmac-sha256",
        "enc_alg": "x25519-aes256gcm",
    }
    header_b64 = _encode_json_b64(header)

    peer_public_bytes = _decode_key_bytes(encrypt_public_key)
    if not peer_public_bytes:
        raise RuntimeError("LICENSE_ENCRYPT_PUBLIC_KEY is invalid; cannot issue PM2 license.")

    ephemeral_private = X25519PrivateKey.generate()
    ephemeral_public = ephemeral_private.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    peer_public = X25519PublicKey.from_public_bytes(peer_public_bytes)
    shared_secret = ephemeral_private.exchange(peer_public)
    aes_key = _derive_pm2_aead_key(shared_secret)
    nonce = secrets.token_bytes(12)
    ciphertext = AESGCM(aes_key).encrypt(
        nonce,
        json.dumps(payload, separators=(",", ":")).encode(),
        header_b64.encode(),
    )
    envelope = {
        "epk": base64.urlsafe_b64encode(ephemeral_public).decode().rstrip("="),
        "nonce": base64.urlsafe_b64encode(nonce).decode().rstrip("="),
        "ct": base64.urlsafe_b64encode(ciphertext).decode().rstrip("="),
    }
    envelope_b64 = _encode_json_b64(envelope)
    signed_message = f"{header_b64}.{envelope_b64}"
    signature, payload["sig_alg"] = _sign_license_payload(signed_message, sign_key, private_key)
    payload["enc_alg"] = "x25519-aes256gcm"
    payload["license_format"] = "PM2"
    return f"PM2-{header_b64}.{envelope_b64}.{signature}", payload


def _license_matches_signer(license_key: str, sign_key: str, private_key: str = "", public_key: str = "") -> bool:
    try:
        if license_key.startswith("PM2-"):
            header_b64, envelope_b64, signature = license_key[4:].split(".", 2)
            message = f"{header_b64}.{envelope_b64}"
        elif license_key.startswith("PM1-"):
            payload_b64, signature = license_key[4:].rsplit(".", 1)
            message = payload_b64
        else:
            return False
        if public_key:
            public_key_bytes = _decode_key_bytes(public_key)
            if public_key_bytes:
                verifier = Ed25519PublicKey.from_public_bytes(public_key_bytes)
                verifier.verify(bytes.fromhex(signature), message.encode())
                return True
        if sign_key:
            expected = hmac.new(sign_key.encode(), message.encode(), hashlib.sha256).hexdigest()
            return hmac.compare_digest(expected, signature)
    except Exception:
        return False


def generate_license(
    tier: str,
    plan: str,
    customer: str,
    sign_key: str = "",
    max_hosts: int = None,
    hw_id: str = None,
    private_key: str = "",
    public_key: str = "",
    encrypt_public_key: str = "",
) -> str:
    """Generate a signed license key with tier and version info."""
    sign_key, private_key, public_key = _resolve_signing_material(sign_key, private_key, public_key)
    encrypt_public_key = _resolve_encrypt_public_key(encrypt_public_key)
    if plan not in PLANS:
        print(f"Warning: plan '{plan}' is not allowed. Falling back to 'testing' (30 days).")
        plan = "testing"

    effective_tier = "enterprise" if plan == "testing" else tier
    if effective_tier not in TIERS:
        print(f"Error: Invalid tier '{effective_tier}'. Choose: {', '.join(TIERS.keys())}")
        sys.exit(1)
    
    # Use tier default if max_hosts not provided
    if max_hosts is None:
        max_hosts = TIERS[effective_tier].get("default_hosts", 0)

    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=PLANS[plan]["days"])
    no_bind = bool(PLANS.get(plan, {}).get("no_bind", False))
    if not no_bind and not (hw_id or "").strip():
        raise RuntimeError("Hardware MAC ID is required for final bound license generation.")

    payload = {
        "v": 5 if encrypt_public_key else 4,
        "license_id": str(uuid.uuid4())[:8],
        "tier": effective_tier,
        "tier_label": TIERS[effective_tier]["label"],
        "features": TIERS[effective_tier]["features"],
        "plan": plan,
        "plan_label": f"{TIERS[effective_tier]['label']} ({PLANS[plan]['label']})",
        "customer": customer,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
        "issued_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "expires_at": expires.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "generated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "max_hosts": max_hosts,
        "hw_id": "" if no_bind else (hw_id or ""),
        "no_bind": no_bind,
        "binding_mode": "portable" if no_bind else "hardware_id",
        "version_compat": VERSION_COMPAT,
        "tool_version": TOOL_VERSION,
        "sig_alg": "ed25519" if private_key else "hmac-sha256",
        "license_format": "PM2" if encrypt_public_key else "PM1",
    }

    # --- BEFORE GENERATION SUMMARY ---
    print("\n" + "PRE-GENERATION SUMMARY".center(64, "-"))
    print(f"  Customer:      {customer}")
    print(f"  Tier:          {TIERS[effective_tier]['label']}")
    print(f"  Plan:          {PLANS[plan]['label']} ({PLANS[plan]['days']} days)")
    print(f"  Host Limit:    {'Unlimited' if max_hosts == 0 else max_hosts}")
    if hw_id:
        print(f"  Bound ID:      {hw_id}")
    print(f"  Features:      {', '.join(TIERS[effective_tier]['features'][:5])}...")
    print("-" * 64)

    # If this customer already has a non-expired license in DB, reuse its issued/expires to preserve remaining days
    try:
        if os.path.exists(DB_PATH):
            db = sqlite3.connect(DB_PATH)
            db.row_factory = sqlite3.Row
            db.execute("PRAGMA foreign_keys=ON;")
            db.execute("CREATE TABLE IF NOT EXISTS licenses (id INTEGER PRIMARY KEY AUTOINCREMENT, license_id TEXT UNIQUE, license_key TEXT, tier TEXT, plan TEXT, features TEXT, max_hosts INTEGER, tool_version TEXT, version_compat TEXT, hw_id TEXT, issued_at TEXT, expires_at TEXT, is_revoked INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))");  # minimal schema safety
            cur = db.execute(
                """
                SELECT l.license_key, l.issued_at, l.expires_at
                FROM licenses l
                JOIN customers c ON c.id = l.customer_id
                WHERE l.plan = ? AND c.name = ?
                ORDER BY l.created_at DESC
                LIMIT 1
                """,
                (plan, customer),
            )
            row = cur.fetchone()
            if row:
                prev_issued = datetime.strptime(row["issued_at"], "%Y-%m-%dT%H:%M:%SZ")
                prev_expires = datetime.strptime(row["expires_at"], "%Y-%m-%dT%H:%M:%SZ")
                if prev_expires > now:
                    if _license_matches_signer(row["license_key"], sign_key, private_key, public_key):
                        # reuse issued/expiry and key so remaining days stay intact
                        print(f"Reusing existing {plan} license; expires {row['expires_at']}")
                        return row["license_key"]
                    print(
                        f"Existing {plan} license for {customer} was signed with a different key; "
                        "issuing a replacement that keeps the same expiry.",
                        file=sys.stderr,
                    )
                    payload["iat"] = int(prev_issued.timestamp())
                    payload["exp"] = int(prev_expires.timestamp())
                    payload["issued_at"] = row["issued_at"]
                    payload["expires_at"] = row["expires_at"]
                    payload["generated_at"] = row["issued_at"]
    except Exception:
        pass

    if encrypt_public_key:
        license_key, payload = _build_pm2_license(payload, sign_key, private_key, encrypt_public_key)
    else:
        raise RuntimeError("LICENSE_ENCRYPT_PUBLIC_KEY is required for PM2 license generation")

    # Store in DB if available
    try:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        db = sqlite3.connect(DB_PATH)
        
        # Ensure tables exist (minimal schema if not running via app.py)
        db.executescript("""
            CREATE TABLE IF NOT EXISTS customers (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                email       TEXT    NOT NULL,
                company     TEXT    NOT NULL DEFAULT '',
                phone       TEXT    NOT NULL DEFAULT '',
                address     TEXT    NOT NULL DEFAULT '',
                notes       TEXT    NOT NULL DEFAULT '',
                status      TEXT    NOT NULL DEFAULT 'active',
                created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
                updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS licenses (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                purchase_id     INTEGER REFERENCES purchases(id) ON DELETE CASCADE,
                customer_id     INTEGER REFERENCES customers(id) ON DELETE CASCADE,
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
                created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
            );
        """)

        # Find or Create Customer (CLI user usually just provides name)
        cursor = db.execute("SELECT id FROM customers WHERE name = ?", (customer,))
        row = cursor.fetchone()
        if row:
            customer_id = row[0]
        else:
            cursor = db.execute(
                "INSERT INTO customers (name, email) VALUES (?, ?)", 
                (customer, f"cli-{uuid.uuid4().hex[:6]}@example.com")
            )
            customer_id = cursor.lastrowid
        
        # Insert License (handle purchase_id column if NOT NULL)
        cols = {row[1]: row for row in db.execute("PRAGMA table_info(licenses)")}
        has_purchase = "purchase_id" in cols
        purchase_value = 0 if has_purchase else None

        if has_purchase:
            db.execute("""
                INSERT INTO licenses (
                    purchase_id, customer_id, license_id, license_key, tier, plan, features, max_hosts,
                    tool_version, version_compat, hw_id, issued_at, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                purchase_value,
                customer_id,
                payload["license_id"],
                license_key,
                payload["tier"],
                payload["plan"],
                json.dumps(payload["features"]),
                payload["max_hosts"],
                payload["tool_version"],
                payload["version_compat"],
                payload["hw_id"] or "",
                datetime.fromtimestamp(payload["iat"], timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                datetime.fromtimestamp(payload["exp"], timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            ))
        else:
            db.execute("""
                INSERT INTO licenses (
                    customer_id, license_id, license_key, tier, plan, features, max_hosts,
                    tool_version, version_compat, hw_id, issued_at, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                customer_id,
                payload["license_id"],
                license_key,
                payload["tier"],
                payload["plan"],
                json.dumps(payload["features"]),
                payload["max_hosts"],
                payload["tool_version"],
                payload["version_compat"],
                payload["hw_id"] or "",
                payload["issued_at"],
                payload["expires_at"]
            ))
        db.commit()
        db.close()
        print(f"  [DB] Stored license record in {DB_PATH}")
    except Exception as e:
        print(f"  [DB] Warning: Failed to store license in DB: {e}")

    generate_license.last_payload = payload
    return license_key


def main():
    parser = argparse.ArgumentParser(
        description="PatchMaster License Generator v2",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Testing licenses only (30 days). Regenerating for the same customer reuses remaining days.

Example:
  python generate-license.py --plan testing --customer "Demo Org"
        """,
    )
    parser.add_argument("--tier", choices=TIERS.keys(), default="enterprise",
                        help="License tier (testing uses enterprise features; value is ignored).")
    parser.add_argument("--plan", required=True, choices=PLANS.keys(),
                        help="Duration / policy: testing (no bind), poc (no bind), trial (bind)")
    parser.add_argument("--customer", required=True, help="Customer / organization name")
    parser.add_argument("--max-hosts", type=int, default=None,
                        help="Override maximum managed hosts (default depends on tier)")
    parser.add_argument("--hw-id", "--bind-id", dest="hw_id", 
                        help="Bind license to specific MAC or Container ID (PM_BINDING_ID)")
    parser.add_argument("--secret", default=DEFAULT_SIGN_KEY,
                        help="Signing secret (must match LICENSE_SIGN_KEY on server; defaults to $LICENSE_SIGN_KEY env var)")
    parser.add_argument("--private-key", default=DEFAULT_SIGN_PRIVATE_KEY,
                        help="Ed25519 private signing key (base64url raw bytes). Preferred over --secret when present.")
    parser.add_argument("--encrypt-public-key", default=DEFAULT_ENCRYPT_PUBLIC_KEY,
                        help="X25519 public encryption key for PM2 encrypted licenses (base64url raw bytes).")
    parser.add_argument("--output", "-o", help="Write license key to file instead of stdout")
    args = parser.parse_args()

    license_key = generate_license(
        args.tier,
        args.plan,
        args.customer,
        args.secret,
        args.max_hosts,
        args.hw_id,
        args.private_key,
        "",
        args.encrypt_public_key,
    )

    payload = getattr(generate_license, "last_payload", {})
    if not payload:
        raise RuntimeError("Generated license payload is unavailable")

    tier_info = TIERS[payload["tier"]]

    print()
    print("=" * 64)
    print("  PatchMaster — License Key Generated (v3)")
    print("=" * 64)
    print(f"  License ID:    {payload['license_id']}")
    print(f"  Customer:      {payload['customer']}")
    print(f"  Tier:          {payload['tier_label']} ({payload['tier']})")
    print(f"  Description:   {tier_info['description']}")
    print(f"  Plan:          {payload['plan_label']}")
    print(f"  Format:        {payload.get('license_format', 'PM1')}")
    print(f"  Binding:       {payload.get('binding_mode', 'portable')}")
    print(f"  Issued:        {datetime.fromtimestamp(payload['iat'], timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}")
    print(f"  Expires:       {datetime.fromtimestamp(payload['exp'], timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}")
    print(f"  Max Hosts:     {'Unlimited' if payload['max_hosts'] == 0 else payload['max_hosts']}")
    print(f"  Version:       {payload['tool_version']} (compatible: {payload['version_compat']})")
    if payload.get("hw_id"):
        print(f"  Hardware ID:   {payload['hw_id']}")
    print("-" * 64)
    print(f"  Features ({len(payload['features'])}):")
    for i in range(0, len(payload['features']), 4):
        row = payload['features'][i:i+4]
        print(f"    {', '.join(row)}")
    print("=" * 64)
    print()

    if args.output:
        with open(args.output, "w") as f:
            f.write(license_key + "\n")
        print(f"LICENSE KEY saved to: {args.output}")
    else:
        print("LICENSE KEY:")
        print(license_key)

    print()
    print("ACTIVATION:")
    print("  Option 1: Place in /opt/patchmaster/license.key")
    print("  Option 2: Use the PatchMaster Web UI -> Settings -> License")
    print("  Option 3: API call:")
    print(f'    curl -X POST http://SERVER:8000/api/license/activate \\')
    print(f'      -H "Content-Type: application/json" \\')
    print(f'      -d \'{{"license_key": "{license_key[:50]}..."}}\'')
    print()


if __name__ == "__main__":
    main()
