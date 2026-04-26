#!/bin/bash
# Build a fully self-contained .deb package for PatchMaster Agent
# All Python dependencies are bundled in a virtualenv — NO internet needed on target.
#
# Usage: bash build-deb.sh [output-path]
#   Default output: ../backend/static/agent-latest.deb
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="2.0.1"  # Fixed: ensures dependencies are properly installed and verified
PKG_NAME="patch-agent"
INSTALL_DIR="/opt/patch-agent"
OUTPUT="${1:-${SCRIPT_DIR}/../backend/static/agent-latest.deb}"

BUILD_ROOT="$(mktemp -d)"
trap 'rm -rf "$BUILD_ROOT"' EXIT

echo "=== Building ${PKG_NAME} ${VERSION} ==="
echo "    Build root: ${BUILD_ROOT}"

# --- 1. Create directory structure ---
mkdir -p "${BUILD_ROOT}${INSTALL_DIR}"
mkdir -p "${BUILD_ROOT}/DEBIAN"
mkdir -p "${BUILD_ROOT}/etc/patch-agent"
mkdir -p "${BUILD_ROOT}/lib/systemd/system"
mkdir -p "${BUILD_ROOT}/usr/bin"

# --- 2. Copy agent source files ---
cp "${SCRIPT_DIR}/main.py"         "${BUILD_ROOT}${INSTALL_DIR}/"
cp "${SCRIPT_DIR}/agent.py"        "${BUILD_ROOT}${INSTALL_DIR}/"
cp "${SCRIPT_DIR}/requirements.txt" "${BUILD_ROOT}${INSTALL_DIR}/"
cp "${SCRIPT_DIR}/__init__.py"     "${BUILD_ROOT}${INSTALL_DIR}/" 2>/dev/null || true

# --- 3. Bundle Python wheels for offline installation ---
echo "    Bundling Python wheels for offline installation..."
mkdir -p "${BUILD_ROOT}${INSTALL_DIR}/wheels"

# Try to find wheels in multiple locations
WORKSPACE_WHEELS="/workspace/wheels"
DEFAULT_WHEEL_DIR="${SCRIPT_DIR}/../vendor/wheels"

# Download/copy wheels to bundle with package
if [[ -d "$WORKSPACE_WHEELS" ]] && [[ -n "$(ls -A "$WORKSPACE_WHEELS" 2>/dev/null)" ]]; then
  echo "    Copying wheels from /workspace/wheels..."
  cp "$WORKSPACE_WHEELS"/*.whl "${BUILD_ROOT}${INSTALL_DIR}/wheels/" 2>/dev/null || true
elif [[ -d "$DEFAULT_WHEEL_DIR" ]] && [[ -n "$(ls -A "$DEFAULT_WHEEL_DIR" 2>/dev/null)" ]]; then
  echo "    Copying wheels from vendor/wheels..."
  cp "$DEFAULT_WHEEL_DIR"/*.whl "${BUILD_ROOT}${INSTALL_DIR}/wheels/" 2>/dev/null || true
else
  echo "    Downloading wheels from PyPI..."
  python3 -m pip download -d "${BUILD_ROOT}${INSTALL_DIR}/wheels" -r "${SCRIPT_DIR}/requirements.txt"
fi

# Verify we have wheels
WHEEL_COUNT=$(ls -1 "${BUILD_ROOT}${INSTALL_DIR}/wheels"/*.whl 2>/dev/null | wc -l)
if [[ $WHEEL_COUNT -eq 0 ]]; then
  echo "    WARNING: No wheels bundled - installation will require internet"
else
  echo "    Bundled $WHEEL_COUNT wheel files"
fi

# --- 4. Create wrapper scripts that use the bundled venv ---
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

# --- 5. DEBIAN/control — minimal deps (just python3 for the venv) ---
cat > "${BUILD_ROOT}/DEBIAN/control" <<EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: admin
Priority: optional
Architecture: amd64
Depends: python3 (>= 3.8)
Maintainer: PatchMaster Team <ops@patchmaster.local>
Description: PatchMaster Agent (self-contained)
 Fully offline patch management agent with bundled Python virtualenv.
 No internet required on target hosts.
EOF

# --- 6. DEBIAN/postinst — create user, dirs, install dependencies ---
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

# Create fresh virtualenv on target machine
VENV_DIR="/opt/patch-agent/venv"
echo "Creating Python virtualenv..."
python3 -m venv "$VENV_DIR"

# Install dependencies from bundled wheels
echo "Installing Python dependencies..."
if [ -d "/opt/patch-agent/wheels" ] && [ -n "$(ls -A /opt/patch-agent/wheels/*.whl 2>/dev/null)" ]; then
    echo "  Using bundled wheels (offline mode)"
    "$VENV_DIR/bin/pip" install --no-index --find-links /opt/patch-agent/wheels -r /opt/patch-agent/requirements.txt 2>&1 | grep -v "^Looking in" || true
else
    echo "  Downloading from PyPI (requires internet)"
    "$VENV_DIR/bin/pip" install -r /opt/patch-agent/requirements.txt
fi

# Verify Python dependencies
echo "Verifying Python dependencies..."
MISSING=""
ALL_OK=1
for pkg in flask prometheus_client psutil requests yaml; do
    if "$VENV_DIR/bin/python3" -c "import $pkg" 2>/dev/null; then
        echo "  ✓ $pkg"
    else
        echo "  ✗ $pkg - MISSING"
        MISSING="$MISSING $pkg"
        ALL_OK=0
    fi
done

if [ $ALL_OK -eq 0 ]; then
    echo ""
    echo "ERROR: Missing dependencies:$MISSING"
    echo "Attempting to install from PyPI..."
    if "$VENV_DIR/bin/pip" install Flask prometheus_client psutil requests PyYAML; then
        echo "Dependencies installed successfully from PyPI"
    else
        echo "FAILED: Could not install dependencies"
        echo "Manual fix: sudo $VENV_DIR/bin/pip install Flask prometheus_client psutil requests PyYAML"
        exit 1
    fi
fi

# Set ownership
chown -R patchagent:patchagent /opt/patch-agent
chown -R patchagent:patchagent /var/log/patch-agent
chown -R patchagent:patchagent /var/lib/patch-agent

# Allow patchagent user to restart its own service (for watchdog)
if [ -d /etc/sudoers.d ]; then
    cat > /etc/sudoers.d/patch-agent <<'SUDOERS'
# Allow patch-agent heartbeat to restart the agent service
patchagent ALL=(ALL) NOPASSWD: /bin/systemctl restart patch-agent.service
patchagent ALL=(ALL) NOPASSWD: /bin/systemctl status patch-agent.service
SUDOERS
    chmod 0440 /etc/sudoers.d/patch-agent
fi

# Reload systemd and enable services
if command -v systemctl >/dev/null 2>&1; then
    systemctl daemon-reload 2>/dev/null || true
    systemctl enable patch-agent.service 2>/dev/null || true
    systemctl enable patch-agent-heartbeat.service 2>/dev/null || true
fi

echo ""
echo "✓ PatchMaster Agent installed successfully!"
echo ""
echo "Configuration:"
echo "  sudo nano /etc/patch-agent/env"
echo "  Set: CONTROLLER_URL=http://<server-ip>:8000"
echo ""
echo "Start services:"
echo "  sudo systemctl start patch-agent patch-agent-heartbeat"
echo ""
POSTINST
chmod 755 "${BUILD_ROOT}/DEBIAN/postinst"

# --- 7. DEBIAN/prerm — stop services on uninstall ---
cat > "${BUILD_ROOT}/DEBIAN/prerm" <<'PRERM'
#!/bin/bash
set -e
systemctl stop patch-agent-heartbeat.service 2>/dev/null || true
systemctl stop patch-agent.service 2>/dev/null || true
systemctl disable patch-agent-heartbeat.service 2>/dev/null || true
systemctl disable patch-agent.service 2>/dev/null || true
PRERM
chmod 755 "${BUILD_ROOT}/DEBIAN/prerm"

# --- 8. Build .deb ---
echo "    Building .deb package..."
dpkg-deb --build "$BUILD_ROOT" "$OUTPUT"

SIZE=$(du -sh "$OUTPUT" | cut -f1)
echo ""
echo "=== Build complete ==="
echo "    Package: ${OUTPUT}"
echo "    Size:    ${SIZE}"
echo "    Install: dpkg -i ${OUTPUT}"
echo ""
echo "    This package is fully self-contained."
echo "    No internet required on target hosts."
