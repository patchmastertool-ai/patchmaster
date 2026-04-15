"""
Build Release Script - Handles release artifact creation and license authority bundling.
"""

import os
import secrets
from pathlib import Path

VERSION = "2.0.14"

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DIST_DIR = PROJECT_ROOT / "dist"
PRIVATE_DIST_DIR = DIST_DIR / "private"
VENDOR_DIST_DIR = PROJECT_ROOT / "vendor" / "dist"

AUTHORITY_FILE_CANDIDATES = (
    str(PROJECT_ROOT / ".license-authority.env"),
    str(PROJECT_ROOT / "patchmaster-license-authority.env"),
)

ENV_TO_LICENSE_KEYS = {
    "PM_RELEASE_LICENSE_SIGN_KEY": "LICENSE_SIGN_KEY",
    "PM_RELEASE_LICENSE_SIGN_PRIVATE_KEY": "LICENSE_SIGN_PRIVATE_KEY",
    "PM_RELEASE_LICENSE_VERIFY_PUBLIC_KEY": "LICENSE_VERIFY_PUBLIC_KEY",
    "PM_RELEASE_LICENSE_DECRYPT_PRIVATE_KEY": "LICENSE_DECRYPT_PRIVATE_KEY",
    "PM_RELEASE_LICENSE_ENCRYPT_PUBLIC_KEY": "LICENSE_ENCRYPT_PUBLIC_KEY",
}


def _load_env_file(env_path: str) -> dict:
    """Load key-value pairs from a .env file."""
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and "=" in line and not line.startswith("#"):
                    key, value = line.split("=", 1)
                    env_vars[key] = value
    return env_vars


def _get_env_or_generate(env_var: str) -> str:
    """Get value from environment or generate a random key."""
    value = os.environ.get(env_var)
    if value:
        return value
    return secrets.token_hex(32)


def _get_license_value_from_env_files(env_key: str) -> str:
    """Try to get value from .env files."""
    project_root = Path(PROJECT_ROOT)
    env_file = project_root / ".env"
    if env_file.exists():
        existing = _load_env_file(str(env_file))
        if env_key in existing:
            return existing[env_key]
    return None


def ensure_release_authority_bundle():
    """Ensure license authority bundle exists with proper keys."""
    authority_vars = {}

    for env_key, license_key in ENV_TO_LICENSE_KEYS.items():
        env_value = os.environ.get(env_key)
        if env_value:
            authority_vars[license_key] = env_value
        else:
            env_file_value = _get_license_value_from_env_files(license_key)
            if env_file_value:
                authority_vars[license_key] = env_file_value
            else:
                authority_vars[license_key] = secrets.token_hex(32)

    for candidate in AUTHORITY_FILE_CANDIDATES:
        if os.path.exists(candidate):
            existing = _load_env_file(candidate)
            for key in authority_vars:
                if key in existing:
                    authority_vars[key] = existing[key]
            break

    env_path = AUTHORITY_FILE_CANDIDATES[0]
    Path(env_path).parent.mkdir(parents=True, exist_ok=True)

    with open(env_path, "w", encoding="utf-8") as f:
        for key, value in authority_vars.items():
            f.write(f"{key}={value}\n")

    public_vars = {
        k: v for k, v in authority_vars.items() if k != "LICENSE_SIGN_PRIVATE_KEY"
    }

    private_dist = Path(PRIVATE_DIST_DIR)
    private_dist.mkdir(parents=True, exist_ok=True)

    authority_text = "".join(f"{k}={v}\n" for k, v in authority_vars.items())
    public_text = "".join(f"{k}={v}\n" for k, v in public_vars.items())

    (private_dist / "patchmaster-license-authority.env").write_text(
        authority_text, encoding="utf-8"
    )
    (private_dist / f"patchmaster-license-authority-{VERSION}.env").write_text(
        authority_text, encoding="utf-8"
    )
    (private_dist / "patchmaster-license-public.env").write_text(
        public_text, encoding="utf-8"
    )


if __name__ == "__main__":
    ensure_release_authority_bundle()
