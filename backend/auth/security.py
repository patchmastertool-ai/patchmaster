"""Security utilities for authentication - token generation, MFA, password hashing, rate limiting."""

import os
import secrets
import hashlib
import time
import re
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from functools import wraps

import jwt
from jwt import InvalidTokenError, ExpiredSignatureError
import bcrypt

# Token configuration
SECRET_KEY = os.getenv("JWT_SECRET", "patchmaster-change-me-in-production-32chars!")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))
TOKEN_LENGTH = 32  # 256-bit tokens

# MFA configuration
MFA_CODE_EXPIRE_MINUTES = 5
MFA_CODE_LENGTH = 6
MFA_ISSUER = "PatchMaster"

# Password configuration
PASSWORD_MIN_LENGTH = 8
PASSWORD_REQUIRE_UPPER = True
PASSWORD_REQUIRE_LOWER = True
PASSWORD_REQUIRE_DIGIT = True
PASSWORD_REQUIRE_SPECIAL = True
MAX_PASSWORD_LENGTH = 128

# Rate limiting configuration
LOGIN_ATTEMPT_WINDOW_SECONDS = 300  # 5 minutes
LOGIN_MAX_ATTEMPTS = 5
TOKEN_REFRESH_WINDOW_SECONDS = 60
TOKEN_REFRESH_MAX_ATTEMPTS = 10

# In-memory rate limiting store (production should use Redis)
_rate_limit_store: dict = {}
_mfa_code_store: dict = {}


def _get_timestamp() -> int:
    """Get current UTC timestamp."""
    return int(time.time())


def _clean_expired_entries(store: dict, max_age_seconds: int):
    """Remove expired entries from store."""
    current_time = _get_timestamp()
    expired_keys = [
        k
        for k, v in store.items()
        if current_time - v.get("timestamp", 0) > max_age_seconds
    ]
    for k in expired_keys:
        store.pop(k, None)


def generate_secure_token(length: int = TOKEN_LENGTH) -> str:
    """Generate a cryptographically secure random token."""
    return secrets.token_urlsafe(length)


def create_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token with secure defaults."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update(
        {
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "jti": secrets.token_hex(16),  # Unique token ID
            "type": "access",
        }
    )
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> Optional[dict]:
    """Verify and decode a JWT token. Returns payload or None if invalid."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Reject refresh tokens used as access tokens
        if payload.get("type") == "refresh":
            return None
        return payload
    except (InvalidTokenError, ExpiredSignatureError):
        return None


def create_refresh_token() -> str:
    """Create a cryptographically secure refresh token."""
    return secrets.token_urlsafe(48)


def hash_password(password: str) -> str:
    """Hash a password using bcrypt with proper configuration."""
    # Truncate to max length before hashing
    password = password[:MAX_PASSWORD_LENGTH]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a password against its bcrypt hash."""
    if not plain or not hashed:
        return False
    try:
        plain = plain[:MAX_PASSWORD_LENGTH]
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        # Invalid hash format
        return False


def validate_password_strength(password: str) -> Tuple[bool, str]:
    """Validate password meets security requirements."""
    if not password:
        return False, "Password is required"

    if len(password) < PASSWORD_MIN_LENGTH:
        return False, f"Password must be at least {PASSWORD_MIN_LENGTH} characters"

    if len(password) > MAX_PASSWORD_LENGTH:
        return False, f"Password must not exceed {MAX_PASSWORD_LENGTH} characters"

    if PASSWORD_REQUIRE_UPPER and not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"

    if PASSWORD_REQUIRE_LOWER and not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"

    if PASSWORD_REQUIRE_DIGIT and not re.search(r"\d", password):
        return False, "Password must contain at least one digit"

    if PASSWORD_REQUIRE_SPECIAL and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character"

    return True, "Password meets requirements"


# ── MFA Support ──


def generate_mfa_secret() -> str:
    """Generate a secure MFA secret."""
    return secrets.token_urlsafe(20)


def create_mfa_code(user_id: int) -> str:
    """Generate a time-limited MFA code."""
    code = "".join([str(secrets.randbelow(10)) for _ in range(MFA_CODE_LENGTH)])
    current_time = _get_timestamp()
    _mfa_code_store[user_id] = {"code": code, "timestamp": current_time, "attempts": 0}
    return code


def verify_mfa_code(user_id: int, code: str, invalidate: bool = True) -> bool:
    """Verify an MFA code. Returns True if valid."""
    _clean_expired_entries(_mfa_code_store, MFA_CODE_EXPIRE_MINUTES * 60)

    stored = _mfa_code_store.get(user_id)
    if not stored:
        return False

    # Check attempts
    if stored.get("attempts", 0) >= 3:
        _mfa_code_store.pop(user_id, None)
        return False

    # Verify code
    if stored.get("code") != code:
        stored["attempts"] = stored.get("attempts", 0) + 1
        return False

    # Success - invalidate code after verification
    if invalidate:
        _mfa_code_store.pop(user_id, None)

    return True


# ── Rate Limiting for Login Attempts ──


def check_login_rate_limit(identifier: str) -> Tuple[bool, int]:
    """Check if login is allowed and return (allowed, remaining_attempts)."""
    _clean_expired_entries(_rate_limit_store, LOGIN_ATTEMPT_WINDOW_SECONDS)

    key = f"login:{identifier}"
    entry = _rate_limit_store.get(key, {"attempts": 0, "timestamp": _get_timestamp()})

    remaining = LOGIN_MAX_ATTEMPTS - entry.get("attempts", 0)
    return remaining > 0, remaining


def record_loginAttempt(identifier: str, success: bool):
    """Record a login attempt. On success, clear rate limit. On failure, increment."""
    key = f"login:{identifier}"

    if success:
        _rate_limit_store.pop(key, None)
    else:
        current_time = _get_timestamp()
        if key in _rate_limit_store:
            _rate_limit_store[key]["attempts"] = (
                _rate_limit_store[key].get("attempts", 0) + 1
            )
            _rate_limit_store[key]["timestamp"] = current_time
        else:
            _rate_limit_store[key] = {"attempts": 1, "timestamp": current_time}


def check_token_refresh_rate_limit(user_id: int) -> Tuple[bool, int]:
    """Check if token refresh is allowed."""
    _clean_expired_entries(_rate_limit_store, TOKEN_REFRESH_WINDOW_SECONDS)

    key = f"refresh:{user_id}"
    entry = _rate_limit_store.get(key, {"attempts": 0, "timestamp": _get_timestamp()})

    remaining = TOKEN_REFRESH_MAX_ATTEMPTS - entry.get("attempts", 0)
    return remaining > 0, remaining


def record_token_refresh(user_id: int):
    """Record a token refresh attempt."""
    key = f"refresh:{user_id}"
    current_time = _get_timestamp()

    if key in _rate_limit_store:
        _rate_limit_store[key]["attempts"] = (
            _rate_limit_store[key].get("attempts", 0) + 1
        )
        _rate_limit_store[key]["timestamp"] = current_time
    else:
        _rate_limit_store[key] = {"attempts": 1, "timestamp": current_time}


# ── Session Management ──

SESSION_COOKIE_NAME = "pm_session"
SESSION_TIMEOUT_MINUTES = int(os.getenv("SESSION_TIMEOUT_MINUTES", "30"))
SESSION_REFRESH_THRESHOLD_MINUTES = 5


def create_session(user_id: int, username: str) -> dict:
    """Create a session object with secure defaults."""
    session_id = secrets.token_urlsafe(32)
    created_at = datetime.now(timezone.utc)
    expires_at = created_at + timedelta(minutes=SESSION_TIMEOUT_MINUTES)

    return {
        "session_id": session_id,
        "user_id": user_id,
        "username": username,
        "created_at": created_at.isoformat(),
        "expires_at": expires_at.isoformat(),
        "last_activity": created_at.isoformat(),
        "ip_address": None,
        "user_agent": None,
    }


def validate_session(session: dict) -> Tuple[bool, str]:
    """Validate a session object. Returns (is_valid, error_message)."""
    if not session:
        return False, "No session provided"

    expires_at = session.get("expires_at")
    if not expires_at:
        return False, "Session missing expiration"

    # Parse expiration time
    if isinstance(expires_at, str):
        try:
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        except ValueError:
            return False, "Invalid expiration format"

    # Check if expired
    if datetime.now(timezone.utc) > expires_at:
        return False, "Session expired"

    return True, "Session valid"


def refresh_session(session: dict) -> Optional[dict]:
    """Refresh session expiration if threshold reached."""
    is_valid, _ = validate_session(session)
    if not is_valid:
        return None

    last_activity = session.get("last_activity")
    if isinstance(last_activity, str):
        try:
            last_activity = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))
        except ValueError:
            return None

    # Check if refresh threshold reached
    time_since_activity = datetime.now(timezone.utc) - last_activity
    if time_since_activity.total_seconds() > SESSION_REFRESH_THRESHOLD_MINUTES * 60:
        # Refresh the session
        new_expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=SESSION_TIMEOUT_MINUTES
        )
        session["last_activity"] = datetime.now(timezone.utc).isoformat()
        session["expires_at"] = new_expires_at.isoformat()
        return session

    return session


def invalidate_session(session: dict) -> bool:
    """Invalidate a session by clearing its data."""
    if session:
        session.clear()
        return True
    return False


# ── Secure Cookie Settings ──


def get_secure_cookie_settings() -> dict:
    """Return secure cookie settings for session cookies."""
    return {
        "name": SESSION_COOKIE_NAME,
        "httponly": True,
        "secure": True,
        "samesite": "strict",
        "path": "/",
        "max_age": SESSION_TIMEOUT_MINUTES * 60,
    }
