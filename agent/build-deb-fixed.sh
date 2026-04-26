#!/bin/bash
# Build a fully self-contained .deb package for PatchMaster Agent
# Fixed version that ensures all dependencies are properly installed
#
# Usage: bash build-deb-fixed.sh [output-path]
#   Default output: ../backend/static/agent-latest.deb
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="2.0.1"  # Bump version to indicate fix
PKG_NAME="patch-agent"
INSTALL_DIR="/opt/patch-agent"

# Detect architecture
ARCH="amd64"
if [[ "$(uname -m)" == "aarch64" || "$(uname -m)" == "arm64" ]]; then
    ARCH="arm64"
fi

OUTPUT="${1:-${SCRIPT_DIR}/../backend/static/agent-latest-${ARCH}.deb}"

BUILD_ROOT="$(mktemp -d)"
trap 'rm -rf "$BUILD_ROOT"' EXIT

echo "=== Building ${PKG_NAME} ${VERSION} ==="
echo "    Build root: ${BUILD_ROOT}"
echo ""

# --- 1. Create directory structure ---
echo "[1/8] Creating directory structure..."
mkdir -p "${BUILD_ROOT}${INSTALL_DIR}"
mkdir -p "${BUILD_ROOT}/DEBIAN"
mkdir -p "${BUILD_ROOT}/etc/patch-agent"
mkdir -p "${BUILD_ROOT}/lib/systemd/system"
mkdir -p "${BUILD_ROOT}/usr/bin"

# --- 2. Copy agent source files ---
echo "[2/8] Copying agent source files..."
cp "${SCRIPT_DIR}/main.py"         "${BUILD_ROOT}${INSTALL_DIR}/"
cp "${SCRIPT_DIR}/agent.py"        "${BUILD_ROOT}${INSTALL_DIR}/"
cp "${SCRIPT_DIR}/requirements.txt" "${BUILD_ROOT}${INSTALL_DIR}/"
cp "${SCRIPT_DIR}/__init__.py"     "${BUILD_ROOT}${INSTALL_DIR}/" 2>/dev/null || true

# --- 3. Create bundled virtualenv with all dependencies ---
echo "[3/8] Creating virtualenv with bundled dependencies..."

# Detect Python command
if command -v python3.12 >/dev/null 2>&1; then
    PYTHON_CMD="python3.12"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
else
    echo "ERROR: Python 3 not found"
    exit 1
fi

echo "    Using Python: $PYTHON_CMD ($($PYTHON_CMD --version 2>&1))"

# Create venv
$PYTHON_CMD -m venv "${BUILD_ROOT}${INSTALL_DIR}/venv"

# Set up pip options - use local wheels for offline installation
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WHEEL_DIR="${PROJECT_ROOT}/vendor/wheels"

VENV_PIP="${BUILD_ROOT}${INSTALL_DIR}/venv/bin/pip"
VENV_PYTHON="${BUILD_ROOT}${INSTALL_DIR}/venv/bin/python3"

if [[ -d "$WHEEL_DIR" ]]; then
    echo "    Using wheels from: $WHEEL_DIR"
    PIP_OPTS="--no-index --find-links ${WHEEL_DIR}"
else
    echo "    WARNING: No local wheels found at $WHEEL_DIR"
    echo "    Will attempt to download from PyPI (requires internet)"
    PIP_OPTS=""
fi

# Upgrade pip first
echo "    Upgrading pip..."
$VENV_PYTHON -m pip install --upgrade pip --quiet $PIP_OPTS 2>/dev/null || {
    # If upgrade fails, try without local wheels
    if [[ -n "$PIP_OPTS" ]]; then
        echo "    WARNING: Could not upgrade pip from local wheels, trying PyPI..."
        $VENV_PYTHON -m pip install --upgrade pip --quiet 2>/dev/null || true
    fi
}

# Install setuptools and wheel
echo "    Installing setuptools and wheel..."
$VENV_PIP install $PIP_OPTS setuptools wheel --quiet 2>/dev/null || {
    if [[ -n "$PIP_OPTS" ]]; then
        echo "    WARNING: Failed from local wheels, trying PyPI..."
        $VENV_PIP install setuptools wheel --quiet 2>/dev/null || true
    fi
}

# Install requirements
echo "    Installing Python dependencies..."
if [[ -n "$PIP_OPTS" ]]; then
    echo "    Installing from local wheels (offline mode)..."
    $VENV_PIP install $PIP_OPTS -r "${SCRIPT_DIR}/requirements.txt" 2>/dev/null || {
        echo "    WARNING: Failed to install from local wheels, trying PyPI..."
        $VENV_PIP install -r "${SCRIPT_DIR}/requirements.txt"
    }
else
    echo "    Installing from PyPI (online mode)..."
    $VENV_PIP install -r "${SCRIPT_DIR}/requirements.txt"
fi

# --- 4. Verify all required packages are installed ---
echo "[4/8] Verifying installed packages..."
REQUIRED_PACKAGES=("Flask" "prometheus_client" "psutil" "requests" "PyYAML")
MISSING_PKGS=""

for pkg in "${REQUIRED_PACKAGES[@]}"; do
    if ! $VENV_PIP show "$pkg" >/dev/null 2>&1; then
        MISSING_PKGS="$MISSING_PKGS $pkg"
        echo "    ✗ MISSING: $pkg"
    else
        echo "    ✓ OK: $pkg"
    fi
done

if [[ -n "$MISSING_PKGS" ]]; then
    echo ""
    echo "ERROR: Missing packages:$MISSING_PKGS"
    echo "The build cannot proceed without all dependencies."
    exit 1
fi

echo ""
echo "    All required packages verified successfully!"

# --- 5. Test imports ---
echo "[5/8] Testing Python imports..."
IMPORT_TESTS=(
    "yaml:PyYAML"
    "requests:requests"
    "flask:Flask"
    "psutil:psutil"
    "prometheus_client:prometheus_client"
)

for test in "${IMPORT_TESTS[@]}"; do
    import_name="${test%%:*}"
    pkg_name="${test##*:}"
    if $VENV_PYTHON -c "import $import_name" 2>/dev/null; then
        echo "    ✓ import $import_name ($pkg_name)"
    else
        echo "    ✗ FAILED: import $import_name ($pkg_name)"
        echo "ERROR: Import test failed for $pkg_name"
        exit 1
    fi
done

# --- 6. Clean up venv to reduce size ---
echo "[6/8] Cleaning up virtualenv..."
rm -rf "${BUILD_ROOT}${INSTALL_DIR}/venv/share" 2>/dev/null || true
find "${BUILD_ROOT}${INSTALL_DIR}/venv" -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
find "${BUILD_ROOT}${INSTALL_DIR}/venv" -name '*.pyc' -delete 2>/dev/null || true
find "${BUILD_ROOT}${INSTALL_DIR}/venv" -name '*.pyo' -delete 2>/dev/null || true

# Remove pip cache
rm -rf "${BUILD_ROOT}${INSTALL_DIR}/venv/lib/python"*/site-packages/pip*/__pycache__ 2>/dev/null || true

echo "    Virtualenv cleaned"

# --- 7. Create wrapper scripts and systemd units ---
echo "[7/8] Creating wrapper scripts and systemd units..."

# Run scripts
cat > "${BUILD_ROOT}${INSTALL_DIR}/run-heartbeat.sh" <<'WRAPPER'
#!/bin/bash
exec /opt/patch-agent/venv/bin/python3 /opt/patch-agent/main.py "$@"
WRAPPER
chmod +x "${BUILD_ROOT}${INSTALL_DIR}/run-heartbeat.sh"

cat > "${BUILD_ROOT}${INSTALL_DIR}/run-api.sh" <<'WRAPPER'
#!/bin/bash
exec /opt/patch-agent/venv/bin/python3 /opt/patch-agent/agent.py --port 8080 --metrics-port 9100 "$@"
WRAPPER
chmod +x "${BUILD_ROOT}${INSTALL_DIR}/run-api.sh"

# Binary symlinks
cat > "${BUILD_ROOT}/usr/bin/patch-agent" <<'WRAPPER'
#!/bin/bash
exec /opt/patch-agent/venv/bin/python3 /opt/patch-agent/agent.py --port 8080 --metrics-port 9100 "$@"
WRAPPER
chmod +x "${BUILD_ROOT}/usr/bin/patch-agent"

cat > "${BUILD_ROOT}/usr/bin/patch-agent-heartbeat" <<'WRAPPER'
#!/bin/bash
exec /opt/patch-agent/venv/bin/python3 /opt/patch-agent/main.py "$@"
WRAPPER
chmod +x "${BUILD_ROOT}/usr/bin/patch-agent-heartbeat"

# Systemd service files
cat > "${BUILD_ROOT}/lib/systemd/system/patch-agent.service" <<'UNIT'
[Unit]
Description=PatchMaster Agent API
After=network.target

[Service]
Type=simple
User=patchagent
Group=patchagent
EnvironmentFile=-/etc/patch-agent/env
ExecStart=/opt/patch-agent/run-api.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

cat > "${BUILD_ROOT}/lib/systemd/system/patch-agent-heartbeat.service" <<'UNIT'
[Unit]
Description=PatchMaster Agent Heartbeat
After=network.target
Wants=patch-agent.service

[Service]
Type=simple
User=patchagent
Group=patchagent
EnvironmentFile=-/etc/patch-agent/env
ExecStart=/opt/patch-agent/run-heartbeat.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT

# --- 8. Create DEBIAN control files ---
echo "[8/8] Creating DEBIAN package metadata..."

cat > "${BUILD_ROOT}/DEBIAN/control" <<EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: admin
Priority: optional
Architecture: ${ARCH}
Depends: python3 (>= 3.8)
Maintainer: PatchMaster Team <ops@patchmaster.local>
Description: PatchMaster Agent (self-contained)
 Fully offline patch management agent with bundled Python virtualenv.
 No internet required on target hosts.
EOF

# postinst script with dependency verification
cat > "${BUILD_ROOT}/DEBIAN/postinst" <<'POSTINST'
#!/bin/bash
set -e

echo "Installing PatchMaster Agent..."

# Create service user if not exists
if ! id -u patchagent >/dev/null 2>&1; then
    useradd -r -s /usr/sbin/nologin -d /opt/patch-agent patchagent 2>/dev/null || true
fi

# Create runtime directories
mkdir -p /var/log/patch-agent
mkdir -p /var/lib/patch-agent/snapshots
mkdir -p /var/lib/patch-agent/offline-debs
mkdir -p /etc/patch-agent

# Fix virtualenv paths
VENV_DIR="/opt/patch-agent/venv"
if [ -f "${VENV_DIR}/bin/activate" ]; then
    sed -i "s|VIRTUAL_ENV=.*|VIRTUAL_ENV=\"${VENV_DIR}\"|g" "${VENV_DIR}/bin/activate" 2>/dev/null || true
fi

# Fix shebang lines in venv/bin scripts
find "${VENV_DIR}/bin" -type f -exec grep -l "^#!.*python" {} \; 2>/dev/null | while read f; do
    sed -i "1s|^#!.*python.*|#!${VENV_DIR}/bin/python3|" "$f" 2>/dev/null || true
done

# Verify dependencies are installed
echo "Verifying Python dependencies..."
MISSING=""
for pkg in Flask prometheus_client psutil requests PyYAML; do
    if ! /opt/patch-agent/venv/bin/pip show "$pkg" >/dev/null 2>&1; then
        MISSING="$MISSING $pkg"
    fi
done

if [ -n "$MISSING" ]; then
    echo "WARNING: Missing dependencies:$MISSING"
    echo "Attempting to install missing packages..."
    /opt/patch-agent/venv/bin/pip install -r /opt/patch-agent/requirements.txt 2>/dev/null || {
        echo "ERROR: Could not install missing dependencies"
        echo "Please run: sudo /opt/patch-agent/venv/bin/pip install -r /opt/patch-agent/requirements.txt"
    }
fi

# Test imports
echo "Testing Python imports..."
if /opt/patch-agent/venv/bin/python3 -c "import yaml; import requests; import flask" 2>/dev/null; then
    echo "✓ All Python dependencies verified"
else
    echo "WARNING: Some imports failed. Agent may not work correctly."
fi

# Enable and start services
if command -v systemctl >/dev/null 2>&1; then
    systemctl daemon-reload 2>/dev/null || true
    systemctl enable patch-agent.service 2>/dev/null || true
    systemctl enable patch-agent-heartbeat.service 2>/dev/null || true
    
    # Only start if CONTROLLER_URL is configured
    if [ -f /etc/patch-agent/env ] && grep -q "CONTROLLER_URL=" /etc/patch-agent/env 2>/dev/null; then
        systemctl restart patch-agent.service 2>/dev/null || true
        systemctl restart patch-agent-heartbeat.service 2>/dev/null || true
        echo "Services started"
    else
        echo "CONTROLLER_URL not configured. Services not started."
        echo "Configure /etc/patch-agent/env and run:"
        echo "  sudo systemctl start patch-agent patch-agent-heartbeat"
    fi
fi

echo ""
echo "PatchMaster Agent ${VERSION} installed successfully!"
echo "Install directory: /opt/patch-agent"
echo ""
echo "Configuration:"
echo "  Edit /etc/patch-agent/env to set CONTROLLER_URL and other options"
echo ""
echo "Management:"
echo "  sudo systemctl start patch-agent"
echo "  sudo systemctl start patch-agent-heartbeat"
echo "  sudo systemctl status patch-agent"
POSTINST
chmod 755 "${BUILD_ROOT}/DEBIAN/postinst"

# prerm script
cat > "${BUILD_ROOT}/DEBIAN/prerm" <<'PRERM'
#!/bin/bash
set -e
if command -v systemctl >/dev/null 2>&1; then
    systemctl stop patch-agent-heartbeat.service 2>/dev/null || true
    systemctl stop patch-agent.service 2>/dev/null || true
    systemctl disable patch-agent-heartbeat.service 2>/dev/null || true
    systemctl disable patch-agent.service 2>/dev/null || true
fi
PRERM
chmod 755 "${BUILD_ROOT}/DEBIAN/prerm"

# --- 9. Build .deb ---
echo ""
echo "Building .deb package..."
dpkg-deb --build "$BUILD_ROOT" "$OUTPUT" 2>/dev/null

SIZE=$(du -sh "$OUTPUT" 2>/dev/null | cut -f1)
echo ""
echo "=== Build Complete ==="
echo "    Package: ${OUTPUT}"
echo "    Size:    ${SIZE}"
echo "    Version: ${VERSION}"
echo ""
echo "    Install with: sudo dpkg -i ${OUTPUT}"
echo ""
echo "    This package includes all Python dependencies."
echo "    No internet required on target hosts."

# Create a symlink to latest
ln -sf "$(basename "$OUTPUT")" "$(dirname "$OUTPUT")/agent-latest.deb" 2>/dev/null || true

echo ""
echo "Build successful!"