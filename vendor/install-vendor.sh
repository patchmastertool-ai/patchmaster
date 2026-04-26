#!/bin/bash
###############################################################################
#  PatchMaster by VYGROUP — Vendor Portal Bare-Metal Installer
#  Target OS: Ubuntu/Debian or RHEL/AlmaLinux/Rocky
###############################################################################

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Configuration
INSTALL_DIR="/opt/patchmaster-vendor"
SVC_USER="pm-vendor"
SVC_GROUP="pm-vendor"
PORT="5050"                     # internal gunicorn port
FRONT_PORT="${FRONT_PORT:-8080}" # external nginx port
DB_PATH="$INSTALL_DIR/data/customers.db"
PACKAGED_AUTHORITY_ENV="$SCRIPT_DIR/patchmaster-license-authority.env"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; }
warn() { echo -e "${YELLOW:-\033[1;33m}[WARN]${NC} $1"; }
warn_stderr() { warn "$1" >&2; }

PLACEHOLDER_LICENSE_KEYS=(
    ""
    "change-me"
    "replace-me"
    "PatchMaster-License-SignKey-2026-Secure"
    "changeme-set-a-strong-random-secret-here"
)

banner() {
    echo -e "${BLUE}"
    cat <<'ART'
  ____       _       _   __  __
 |  _ \ __ _| |_ ___| | |  \/  | __ _ ___| |_ ___ _ __
 | |_) / _` | __/ __| |_| |\/| |/ _` / __| __/ _ \ '__|
 |  __/ (_| | || (__| '_| |  | | (_| \__ \ ||  __/ |
 |_|   \__,_|\__\___|_| |_|  |_|\__,_|___/\__\___|_|
ART
    echo -e "${NC}"
    echo "       PatchMaster by VYGROUP"
    echo "         Vendor Portal Installer"
    echo
}

port_in_use() {
    local port="$1"
    if command -v ss >/dev/null 2>&1; then
        ss -tln 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${port}$"
    elif command -v netstat >/dev/null 2>&1; then
        netstat -tln 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${port}$"
    else
        return 1
    fi
}
choose_port() {
    local desired="$1"; shift
    local candidate="$desired"
    if port_in_use "$desired"; then
        warn "Port $desired is in use; selecting another port for the vendor portal..." >&2
        for p in "$@"; do
            if ! port_in_use "$p"; then
                candidate="$p"; break
            fi
        done
    fi
    echo "$candidate"
}

is_placeholder_license_key() {
    local value="$1"
    value="$(echo "${value:-}" | xargs)"
    [[ -z "$value" ]] && return 0
    local lowered="${value,,}"
    [[ "$lowered" == changeme-* || "$lowered" == replace-me* ]] && return 0
    local item
    for item in "${PLACEHOLDER_LICENSE_KEYS[@]}"; do
        [[ "$value" == "$item" ]] && return 0
    done
    return 1
}

if [[ $EUID -ne 0 ]]; then
   err "This script must be run as root (sudo)"
   exit 1
fi

banner
log "Starting PatchMaster by VYGROUP Vendor Portal installation..."

# 1. Detect OS
# Check Python version
PY_VER=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
log "Python version: $PY_VER"

# Extract major/minor without relying on `bc` (not always installed)
PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
if [[ "$PY_MAJOR" -lt 3 ]] || [[ "$PY_MAJOR" -eq 3 && "$PY_MINOR" -lt 8 ]]; then
    err "PatchMaster requires Python 3.8 or higher. Found: $PY_VER"
    exit 1
fi

if [[ -f /etc/debian_version ]]; then
    DISTRO="debian"
    PKG_MGR="apt-get"
elif [[ -f /etc/redhat-release ]]; then
    DISTRO="rhel"
    PKG_MGR="dnf"
else
    err "Unsupported distribution. Only Debian/Ubuntu or RHEL-based systems are supported."
    exit 1
fi

# Select a free external port for nginx
FRONT_PORT=$(choose_port "$FRONT_PORT" 8081 8088 8888 9080)
log "Vendor portal web port: $FRONT_PORT (internal app on $PORT)"

# 2. Install Dependencies
log "Installing system dependencies..."
if [[ "$DISTRO" == "debian" ]]; then
    apt-get update -qq
    apt-get install -y -qq python3 python3-venv python3-pip nginx curl sqlite3 > /dev/null
elif [[ "$DISTRO" == "rhel" ]]; then
    $PKG_MGR install -y -q python3 python3-pip nginx sqlite > /dev/null
fi

# 3. Create Service User
if ! id "$SVC_USER" &>/dev/null; then
    useradd --system --shell /usr/sbin/nologin --home-dir "$INSTALL_DIR" "$SVC_USER"
    log "Created system user: $SVC_USER"
fi

# Stop service if already running (safe for updates)
systemctl stop pm-vendor 2>/dev/null || true

# 4. Set up Directories
log "Setting up directories..."
mkdir -p "$INSTALL_DIR"/{data,templates,static}

# Always copy latest app code and templates (safe for re-runs / updates)
log "Deploying latest app.py and templates..."
cp "$SCRIPT_DIR/app.py" "$INSTALL_DIR/app.py"
cp -r "$SCRIPT_DIR/templates/"* "$INSTALL_DIR/templates/"
[[ -f "$SCRIPT_DIR/generate-license.py" ]] && cp "$SCRIPT_DIR/generate-license.py" "$INSTALL_DIR/"
[[ -f "$SCRIPT_DIR/requirements.txt" ]] && cp "$SCRIPT_DIR/requirements.txt" "$INSTALL_DIR/"

# 5. Set up Python Environment
log "Setting up Python virtual environment..."
cd "$INSTALL_DIR"
python3 -m venv venv
venv/bin/pip install --upgrade pip -q
PIP_ARGS=()
if [[ -d "$SCRIPT_DIR/wheels" ]]; then
    PIP_ARGS+=(--find-links "$SCRIPT_DIR/wheels")
    log "Using bundled wheel cache from $SCRIPT_DIR/wheels"
fi
venv/bin/pip install "${PIP_ARGS[@]}" -r requirements.txt gunicorn -q

# 6. Configure Environment
_read_env_value() {
    local file="$1"
    local key="$2"
    [[ -f "$file" ]] || return 0
    grep -E "^${key}=" "$file" | head -1 | cut -d= -f2- | sed 's/#.*//' | xargs
}

SHARED_AUTHORITY_ENV="${PATCHMASTER_SHARED_AUTHORITY_ENV:-/var/lib/patchmaster/shared-license.env}"

_persist_shared_env_value() {
    local file="$1"
    local key="$2"
    local value="$3"
    local tmp dir
    dir="$(dirname "$file")"
    mkdir -p "$dir"
    chmod 700 "$dir" 2>/dev/null || true
    tmp="$(mktemp)"
    if [[ -f "$file" ]]; then
        awk -v wanted="$key" -v replacement="$value" '
            BEGIN { updated = 0 }
            /^[[:space:]]*#/ { print; next }
            $0 ~ ("^[[:space:]]*" wanted "=") {
                if (!updated) {
                    print wanted "=" replacement
                    updated = 1
                }
                next
            }
            { print }
            END {
                if (!updated) {
                    print wanted "=" replacement
                }
            }
        ' "$file" > "$tmp"
    else
        printf '%s=%s\n' "$key" "$value" > "$tmp"
    fi
    install -m 600 "$tmp" "$file"
    rm -f "$tmp"
}

_resolve_license_key() {
    local key=""
    # 1. Already in environment
    key="${LICENSE_SIGN_KEY:-}"
    if [[ -n "$key" ]] && ! is_placeholder_license_key "$key"; then
        echo "$key"
        return
    fi
    # 2. Reuse a packaged authority bundle when present beside the installer.
    key="$(_read_env_value "$PACKAGED_AUTHORITY_ENV" "LICENSE_SIGN_KEY")"
    if [[ -n "$key" ]] && ! is_placeholder_license_key "$key"; then
        echo "$key"
        return
    fi
    # 3. Reuse a shared authority signer when present on the host.
    key="$(_read_env_value "$SHARED_AUTHORITY_ENV" "LICENSE_SIGN_KEY")"
    if [[ -n "$key" ]] && ! is_placeholder_license_key "$key"; then
        echo "$key"
        return
    fi
    # 4. Preserve an existing vendor key across reinstalls/upgrades.
    key="$(_read_env_value "$INSTALL_DIR/.env" "LICENSE_SIGN_KEY")"
    if [[ -n "$key" ]] && ! is_placeholder_license_key "$key"; then
        echo "$key"
        return
    fi
    # 5. Generate a standalone vendor signer on first install.
    key=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
    warn_stderr "LICENSE_SIGN_KEY not found in the vendor environment."
    warn_stderr "Generated a vendor signing key: $key"
    warn_stderr "Keep this value safe. Any PatchMaster server that should accept licenses from this vendor must use the same LICENSE_SIGN_KEY."
    echo "$key"
}
LICENSE_SIGN_KEY="$(_resolve_license_key)"

_resolve_private_key() {
    local key=""
    key="${LICENSE_SIGN_PRIVATE_KEY:-}"
    if [[ -n "$key" ]]; then
        echo "$key"
        return
    fi
    key="$(_read_env_value "$PACKAGED_AUTHORITY_ENV" "LICENSE_SIGN_PRIVATE_KEY")"
    if [[ -n "$key" ]]; then
        echo "$key"
        return
    fi
    key="$(_read_env_value "$SHARED_AUTHORITY_ENV" "LICENSE_SIGN_PRIVATE_KEY")"
    if [[ -n "$key" ]]; then
        echo "$key"
        return
    fi
    key="$(_read_env_value "$INSTALL_DIR/.env" "LICENSE_SIGN_PRIVATE_KEY")"
    if [[ -n "$key" ]]; then
        echo "$key"
        return
    fi
    python3 - <<'PY'
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
import base64

private_key = Ed25519PrivateKey.generate()
private_bytes = private_key.private_bytes(
    encoding=serialization.Encoding.Raw,
    format=serialization.PrivateFormat.Raw,
    encryption_algorithm=serialization.NoEncryption(),
)
print(base64.urlsafe_b64encode(private_bytes).decode().rstrip("="))
PY
}

_resolve_public_key() {
    local key=""
    key="${LICENSE_VERIFY_PUBLIC_KEY:-}"
    if [[ -n "$key" ]]; then
        echo "$key"
        return
    fi
    key="$(_read_env_value "$PACKAGED_AUTHORITY_ENV" "LICENSE_VERIFY_PUBLIC_KEY")"
    if [[ -n "$key" ]]; then
        echo "$key"
        return
    fi
    key="$(_read_env_value "$SHARED_AUTHORITY_ENV" "LICENSE_VERIFY_PUBLIC_KEY")"
    if [[ -n "$key" ]]; then
        echo "$key"
        return
    fi
    key="$(_read_env_value "$INSTALL_DIR/.env" "LICENSE_VERIFY_PUBLIC_KEY")"
    if [[ -n "$key" ]]; then
        echo "$key"
        return
    fi
    if [[ -n "${LICENSE_SIGN_PRIVATE_KEY:-}" ]]; then
        python3 - <<PY
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
import base64

private_value = "${LICENSE_SIGN_PRIVATE_KEY}"
padding = "=" * ((4 - len(private_value) % 4) % 4)
private_bytes = base64.urlsafe_b64decode((private_value + padding).encode())
public_bytes = Ed25519PrivateKey.from_private_bytes(private_bytes).public_key().public_bytes(
    encoding=serialization.Encoding.Raw,
    format=serialization.PublicFormat.Raw,
)
print(base64.urlsafe_b64encode(public_bytes).decode().rstrip("="))
PY
    fi
}

_resolve_encrypt_public_key() {
    local key=""
    key="${LICENSE_ENCRYPT_PUBLIC_KEY:-}"
    if [[ -n "$key" ]]; then
        echo "$key"
        return
    fi
    key="$(_read_env_value "$PACKAGED_AUTHORITY_ENV" "LICENSE_ENCRYPT_PUBLIC_KEY")"
    if [[ -n "$key" ]]; then
        echo "$key"
        return
    fi
    key="$(_read_env_value "$SHARED_AUTHORITY_ENV" "LICENSE_ENCRYPT_PUBLIC_KEY")"
    if [[ -n "$key" ]]; then
        echo "$key"
        return
    fi
    key="$(_read_env_value "$INSTALL_DIR/.env" "LICENSE_ENCRYPT_PUBLIC_KEY")"
    if [[ -n "$key" ]]; then
        echo "$key"
    fi
}

LICENSE_SIGN_PRIVATE_KEY="$(_resolve_private_key)"
if [[ -z "${LICENSE_VERIFY_PUBLIC_KEY:-}" ]]; then
    LICENSE_VERIFY_PUBLIC_KEY="$(_resolve_public_key)"
fi
if [[ -z "${LICENSE_VERIFY_PUBLIC_KEY:-}" && -n "${LICENSE_SIGN_PRIVATE_KEY:-}" ]]; then
    LICENSE_VERIFY_PUBLIC_KEY="$(LICENSE_SIGN_PRIVATE_KEY="$LICENSE_SIGN_PRIVATE_KEY" python3 - <<'PY'
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
import base64
import os

private_value = os.environ.get("LICENSE_SIGN_PRIVATE_KEY", "").strip()
padding = "=" * ((4 - len(private_value) % 4) % 4)
private_bytes = base64.urlsafe_b64decode((private_value + padding).encode())
public_bytes = Ed25519PrivateKey.from_private_bytes(private_bytes).public_key().public_bytes(
    encoding=serialization.Encoding.Raw,
    format=serialization.PublicFormat.Raw,
)
print(base64.urlsafe_b64encode(public_bytes).decode().rstrip("="))
PY
)"
fi
LICENSE_ENCRYPT_PUBLIC_KEY="$(_resolve_encrypt_public_key)"

_persist_shared_env_value "$SHARED_AUTHORITY_ENV" "LICENSE_SIGN_KEY" "$LICENSE_SIGN_KEY"
_persist_shared_env_value "$SHARED_AUTHORITY_ENV" "LICENSE_SIGN_PRIVATE_KEY" "$LICENSE_SIGN_PRIVATE_KEY"
_persist_shared_env_value "$SHARED_AUTHORITY_ENV" "LICENSE_VERIFY_PUBLIC_KEY" "$LICENSE_VERIFY_PUBLIC_KEY"
if [[ -n "${LICENSE_ENCRYPT_PUBLIC_KEY:-}" ]]; then
    _persist_shared_env_value "$SHARED_AUTHORITY_ENV" "LICENSE_ENCRYPT_PUBLIC_KEY" "$LICENSE_ENCRYPT_PUBLIC_KEY"
fi

_resolve_cm_secret() {
    local key=""
    key="${CM_SECRET_KEY:-}"
    if [[ -n "$key" ]]; then
        echo "$key"
        return
    fi
    key="$(_read_env_value "$INSTALL_DIR/.env" "CM_SECRET_KEY")"
    if [[ -n "$key" ]]; then
        echo "$key"
        return
    fi
    python3 -c 'import secrets; print(secrets.token_hex(32))'
}
CM_SECRET_KEY="$(_resolve_cm_secret)"

_resolve_cm_admin_pass() {
    local pass=""
    pass="${CM_ADMIN_PASS:-}"
    if [[ -n "$pass" ]]; then
        echo "$pass"
        return
    fi
    pass="$(_read_env_value "$INSTALL_DIR/.env" "CM_ADMIN_PASS")"
    if [[ -n "$pass" ]]; then
        echo "$pass"
        return
    fi
    python3 -c 'import secrets, string; print("".join(secrets.choice(string.ascii_letters + string.digits) for i in range(16)))'
}
CM_ADMIN_PASS="$(_resolve_cm_admin_pass)"
CM_ADMIN_USER="${CM_ADMIN_USER:-admin}"

cat > "$INSTALL_DIR/.env" <<EOF
CM_DB_PATH=$DB_PATH
CM_SECRET_KEY=$CM_SECRET_KEY
CM_ADMIN_USER=$CM_ADMIN_USER
CM_ADMIN_PASS=$CM_ADMIN_PASS
LICENSE_SIGN_KEY=$LICENSE_SIGN_KEY
LICENSE_SIGN_PRIVATE_KEY=$LICENSE_SIGN_PRIVATE_KEY
LICENSE_VERIFY_PUBLIC_KEY=$LICENSE_VERIFY_PUBLIC_KEY
LICENSE_ENCRYPT_PUBLIC_KEY=$LICENSE_ENCRYPT_PUBLIC_KEY
PM_VENDOR_ENABLE_ACTIVATION_CALLBACK=0
LOG_LEVEL=INFO
EOF
chown -R "$SVC_USER:$SVC_GROUP" "$INSTALL_DIR"
chmod 600 "$INSTALL_DIR/.env"
# Ensure venv binaries are executable by the service user
chmod -R a+rX "$INSTALL_DIR/venv"

# Initialize the SQLite schema before Gunicorn starts so first login/dashboard
# requests do not race against an empty database file.
log "Initializing vendor database schema..."
(
    cd "$INSTALL_DIR"
    sudo -u "$SVC_USER" env \
        CM_DB_PATH="$DB_PATH" \
        CM_SECRET_KEY="$(grep '^CM_SECRET_KEY=' "$INSTALL_DIR/.env" | cut -d= -f2-)" \
        CM_ADMIN_PASS="$(grep '^CM_ADMIN_PASS=' "$INSTALL_DIR/.env" | cut -d= -f2-)" \
        LICENSE_SIGN_KEY="$LICENSE_SIGN_KEY" \
        "$INSTALL_DIR/venv/bin/python" -c "import app; app.init_db()" \
    || {
        log "Schema init as $SVC_USER failed, retrying as root..."
        CM_DB_PATH="$DB_PATH" \
        CM_SECRET_KEY="$(grep '^CM_SECRET_KEY=' "$INSTALL_DIR/.env" | cut -d= -f2-)" \
        CM_ADMIN_PASS="$(grep '^CM_ADMIN_PASS=' "$INSTALL_DIR/.env" | cut -d= -f2-)" \
        LICENSE_SIGN_KEY="$LICENSE_SIGN_KEY" \
        "$INSTALL_DIR/venv/bin/python" -c "import app; app.init_db()"
        chown "$SVC_USER:$SVC_GROUP" "$DB_PATH" 2>/dev/null || true
    }
)

# 7. Create Systemd Service
log "Creating systemd service..."
# Ensure logs directory exists (though SQLite doesn't need much, Gunicorn might)
mkdir -p "$INSTALL_DIR/logs"
chown "$SVC_USER:$SVC_GROUP" "$INSTALL_DIR/logs"

cat > /etc/systemd/system/pm-vendor.service <<EOF
[Unit]
Description=PatchMaster by VYGROUP Vendor Portal
After=network.target

[Service]
Type=simple
User=$SVC_USER
Group=$SVC_GROUP
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=$INSTALL_DIR/venv/bin/gunicorn app:app --bind 127.0.0.1:$PORT --workers 2
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable pm-vendor
systemctl start pm-vendor

# 8. Configure Nginx
log "Configiling Nginx..."
cat > /etc/nginx/sites-available/pm-vendor <<EOF
server {
    listen ${FRONT_PORT};
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

if [[ -d /etc/nginx/sites-enabled ]]; then
    ln -sf /etc/nginx/sites-available/pm-vendor /etc/nginx/sites-enabled/pm-vendor
    rm -f /etc/nginx/sites-enabled/default
fi

nginx -t && systemctl restart nginx

log "Installation complete!"
log "Vendor Portal is running on http://localhost:${FRONT_PORT}"
log "=========================================================="
log "Vendor Portal Login Credentials:"
log "  Username: ${CM_ADMIN_USER}"
log "  Password: ${CM_ADMIN_PASS}"
log "=========================================================="
