#!/bin/bash
# Build a fully self-contained .deb package for PatchMaster Agent
# All Python dependencies are bundled in a virtualenv — NO internet needed on target.
#
# Usage: bash build-deb.sh [output-path]
#   Default output: ../backend/static/agent-latest.deb
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="2.0.0"
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

# --- 3. Create bundled virtualenv with all dependencies ---
echo "    Creating virtualenv with bundled dependencies..."
python3 -m venv "${BUILD_ROOT}${INSTALL_DIR}/venv"

# Try to find wheels in multiple locations
WORKSPACE_WHEELS="/workspace/wheels"
DEFAULT_WHEEL_DIR="${SCRIPT_DIR}/../vendor/wheels"
CACHE_WHEELS="$HOME/.cache/pip/wheels"

PIP_OPTS=""
WHEEL_DIR=""
if [[ -d "$WORKSPACE_WHEELS" ]]; then
  echo "    Using wheels from /workspace/wheels"
  PIP_OPTS="--find-links ${WORKSPACE_WHEELS} --no-index"
  WHEEL_DIR="$WORKSPACE_WHEELS"
elif [[ -d "$DEFAULT_WHEEL_DIR" ]]; then
  echo "    Using wheels from vendor/wheels"
  PIP_OPTS="--find-links ${DEFAULT_WHEEL_DIR} --no-index"
  WHEEL_DIR="$DEFAULT_WHEEL_DIR"
elif [[ -d "$CACHE_WHEELS" ]]; then
  echo "    Using wheels from cache"
  PIP_OPTS="--find-links ${CACHE_WHEELS}"
  WHEEL_DIR="$CACHE_WHEELS"
else
  echo "    WARNING: No local wheels found, will download from PyPI"
  echo "    For offline installations, ensure vendor/wheels directory exists"
fi

export PIP_DISABLE_PIP_VERSION_CHECK=1
VENV_PIP="${BUILD_ROOT}${INSTALL_DIR}/venv/bin/pip"

# Install setuptools and wheel first
if [[ -n "$WHEEL_DIR" ]]; then
  $VENV_PIP install $PIP_OPTS -q setuptools wheel 2>/dev/null || {
    echo "    WARNING: Failed to install from local wheels, trying PyPI..."
    $VENV_PIP install -q setuptools wheel
  }
else
  $VENV_PIP install -q setuptools wheel
fi

# Install requirements from local wheels (offline mode)
if [[ -n "$WHEEL_DIR" ]]; then
  echo "    Installing dependencies from local wheels (offline mode)..."
  $VENV_PIP install $PIP_OPTS -q -r "${SCRIPT_DIR}/requirements.txt" 2>/dev/null || {
    echo "    WARNING: Failed to install from local wheels, trying PyPI..."
    $VENV_PIP install -q -r "${SCRIPT_DIR}/requirements.txt"
  }
else
  echo "    Installing dependencies from PyPI (requires internet)..."
  $VENV_PIP install -q -r "${SCRIPT_DIR}/requirements.txt"
fi

echo "    Dependencies installed into venv."

# Verify all required packages are installed
echo "    Verifying installed packages..."
MISSING_PKGS=""
for pkg in Flask prometheus_client psutil requests PyYAML; do
  if ! $VENV_PIP show "$pkg" >/dev/null 2>&1; then
    MISSING_PKGS="$MISSING_PKGS $pkg"
  fi
done

if [[ -n "$MISSING_PKGS" ]]; then
  echo "    ERROR: Missing packages:$MISSING_PKGS"
  echo "    Agent package may not work offline!"
  exit 1
fi

echo "    All required packages verified."

# Remove pip/setuptools cache to reduce size
rm -rf "${BUILD_ROOT}${INSTALL_DIR}/venv/share" 2>/dev/null || true
find "${BUILD_ROOT}${INSTALL_DIR}/venv" -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
find "${BUILD_ROOT}${INSTALL_DIR}/venv" -name '*.pyc' -delete 2>/dev/null || true

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

# --- 6. DEBIAN/postinst — create user, dirs, fix venv paths ---
cat > "${BUILD_ROOT}/DEBIAN/postinst" <<'POSTINST'
#!/bin/bash
set -e

# Create service user if not exists
if ! id -u patchagent >/dev/null 2>&1; then
    useradd -r -s /usr/sbin/nologin -d /opt/patch-agent patchagent 2>/dev/null || true
fi

# Create runtime directories
mkdir -p /var/log/patch-agent
mkdir -p /var/lib/patch-agent/snapshots
mkdir -p /var/lib/patch-agent/offline-debs
mkdir -p /etc/patch-agent

# Fix virtualenv paths (they contain the build host path; rewrite to target)
VENV_DIR="/opt/patch-agent/venv"
if [ -f "${VENV_DIR}/bin/activate" ]; then
    sed -i "s|VIRTUAL_ENV=.*|VIRTUAL_ENV=\"${VENV_DIR}\"|g" "${VENV_DIR}/bin/activate" 2>/dev/null || true
fi
# Fix shebang lines in venv/bin scripts
find "${VENV_DIR}/bin" -type f -exec grep -l "^#!.*python" {} \; 2>/dev/null | while read f; do
    sed -i "1s|^#!.*python.*|#!${VENV_DIR}/bin/python3|" "$f" 2>/dev/null || true
done

if command -v systemctl >/dev/null 2>&1; then
    systemctl daemon-reload 2>/dev/null || true
    systemctl enable patch-agent.service 2>/dev/null || true
    systemctl enable patch-agent-heartbeat.service 2>/dev/null || true
    systemctl restart patch-agent.service 2>/dev/null || true
    systemctl restart patch-agent-heartbeat.service 2>/dev/null || true
fi

echo "PatchMaster Agent installed to /opt/patch-agent"
echo "Use install.sh or configure manually:"
echo "  echo 'CONTROLLER_URL=http://<master>:8000' > /etc/patch-agent/env"
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
