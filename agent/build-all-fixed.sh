#!/bin/bash
# Build all agent packages with fixed dependencies
# This script builds packages for all supported platforms
#
# Usage: bash build-all-fixed.sh [version]
#   Default version: 2.0.1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="${1:-2.0.1}"
DIST_DIR="${SCRIPT_DIR}/dist"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WHEEL_DIR="${PROJECT_ROOT}/vendor/wheels"

# Determine architecture
ARCH="amd64"
if [[ "$(uname -m)" == "aarch64" || "$(uname -m)" == "arm64" ]]; then
    ARCH="arm64"
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "========================================"
echo "  Building All PatchMaster Agent Packages"
echo "  Version: ${VERSION}"
echo "  Wheel Dir: ${WHEEL_DIR}"
echo "========================================"
echo ""

# Check WSL and Python
if ! command -v python3 >/dev/null 2>&1; then
    error "Python 3 not found"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
log "Python version: ${PYTHON_VERSION}"

# Check wheels directory
if [[ ! -d "$WHEEL_DIR" ]]; then
    error "Wheel directory not found: ${WHEEL_DIR}"
    exit 1
fi

# Create dist directory
mkdir -p "${DIST_DIR}"

# --- Build .deb package ---
log "Building .deb package..."
if [[ -f "${SCRIPT_DIR}/build-deb-fixed.sh" ]]; then
    bash "${SCRIPT_DIR}/build-deb-fixed.sh" "${DIST_DIR}/patch-agent-${VERSION}-${ARCH}.deb" || error "Failed to build .deb"
else
    bash "${SCRIPT_DIR}/build-deb.sh" "${DIST_DIR}/patch-agent-${VERSION}-${ARCH}.deb" || error "Failed to build .deb"
fi
success "Built .deb package"

# --- Build portable tarballs with bundled virtualenv ---

# Function to build portable package with venv
build_portable_package() {
    local platform="$1"
    local package_name="$2"
    local stage_dir="${DIST_DIR}/${platform}_stage"
    
    log "Building ${platform} portable package..."
    
    rm -rf "${stage_dir}"
    mkdir -p "${stage_dir}"
    
    # Copy agent files
    cp "${SCRIPT_DIR}/agent.py" "${stage_dir}/"
    cp "${SCRIPT_DIR}/main.py" "${stage_dir}/"
    cp "${SCRIPT_DIR}/requirements.txt" "${stage_dir}/"
    cp "${SCRIPT_DIR}/__init__.py" "${stage_dir}/" 2>/dev/null || true
    
    # Create virtualenv with dependencies
    log "  Creating virtualenv with dependencies..."
    python3 -m venv "${stage_dir}/venv"
    
    VENV_PIP="${stage_dir}/venv/bin/pip"
    VENV_PYTHON="${stage_dir}/venv/bin/python3"
    
    # Upgrade pip and install setuptools
    $VENV_PYTHON -m pip install --upgrade pip --quiet --no-index --find-links "${WHEEL_DIR}" 2>/dev/null || \
    $VENV_PYTHON -m pip install --upgrade pip --quiet 2>/dev/null || true
    
    $VENV_PIP install --no-index --find-links "${WHEEL_DIR}" setuptools wheel --quiet 2>/dev/null || \
    $VENV_PIP install setuptools wheel --quiet 2>/dev/null || true
    
    # Install requirements
    $VENV_PIP install --no-index --find-links "${WHEEL_DIR}" -r "${SCRIPT_DIR}/requirements.txt" 2>/dev/null || \
    $VENV_PIP install -r "${SCRIPT_DIR}/requirements.txt" 2>/dev/null || {
        error "Failed to install dependencies for ${platform}"
        return 1
    }
    
    # Verify installation
    log "  Verifying dependencies..."
    MISSING=""
    for pkg in Flask prometheus_client psutil requests PyYAML; do
        if ! $VENV_PIP show "$pkg" >/dev/null 2>&1; then
            MISSING="${MISSING} ${pkg}"
        fi
    done
    
    if [[ -n "$MISSING" ]]; then
        error "Missing packages for ${platform}:${MISSING}"
        return 1
    fi
    
    # Test imports
    if ! $VENV_PYTHON -c "import yaml; import requests; import flask" 2>/dev/null; then
        error "Import test failed for ${platform}"
        return 1
    fi
    
    # Create startup script that uses bundled venv
    cat > "${stage_dir}/start-agent.sh" << EOF
#!/bin/bash
# PatchMaster Agent ${VERSION} - ${platform}
# Self-contained with bundled Python dependencies

SCRIPT_DIR="\$(cd "\$(dirname "\$0")" && pwd)"
CONTROLLER_URL=\${CONTROLLER_URL:-http://localhost:8000}
PORT=\${PORT:-8080}
METRICS_PORT=\${METRICS_PORT:-9100}

# Use bundled virtualenv
exec "\${SCRIPT_DIR}/venv/bin/python3" "\${SCRIPT_DIR}/agent.py" \\
    --port "\$PORT" \\
    --metrics-port "\$METRICS_PORT" \\
    --controller-url "\$CONTROLLER_URL" \\
    "\$@"
EOF
    chmod +x "${stage_dir}/start-agent.sh"
    
    # Create heartbeat startup script
    cat > "${stage_dir}/start-heartbeat.sh" << EOF
#!/bin/bash
# PatchMaster Agent Heartbeat ${VERSION} - ${platform}
SCRIPT_DIR="\$(cd "\$(dirname "\$0")" && pwd)"
CONTROLLER_URL=\${CONTROLLER_URL:-http://localhost:8000}
exec "\${SCRIPT_DIR}/venv/bin/python3" "\${SCRIPT_DIR}/main.py" "\$@"
EOF
    chmod +x "${stage_dir}/start-heartbeat.sh"
    
    # Clean up venv to reduce size
    rm -rf "${stage_dir}/venv/share" 2>/dev/null || true
    find "${stage_dir}/venv" -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
    find "${stage_dir}/venv" -name '*.pyc' -delete 2>/dev/null || true
    
    # Create archive
    cd "${stage_dir}"
    tar -czf "${DIST_DIR}/${package_name}" .
    
    success "Built ${platform} package: ${DIST_DIR}/${package_name}"
}

# Build portable packages for various platforms
build_portable_package "rhel" "patch-agent-${VERSION}-${ARCH}.rhel.tar.gz"
build_portable_package "arch" "patch-agent-${VERSION}-${ARCH}.arch.tar.gz"
build_portable_package "alpine" "patch-agent-${VERSION}-${ARCH}.alpine.tar.gz"
build_portable_package "debian" "patch-agent-${VERSION}-${ARCH}.debian.tar.gz"
build_portable_package "ubuntu" "patch-agent-${VERSION}-${ARCH}.ubuntu.tar.gz"

# --- Build FreeBSD package (with bundled venv like other platforms) ---
log "Building FreeBSD portable package with bundled dependencies..."
FREEBSD_STAGE="${DIST_DIR}/freebsd_stage"
rm -rf "${FREEBSD_STAGE}"
mkdir -p "${FREEBSD_STAGE}"

# Copy agent files
cp "${SCRIPT_DIR}/agent.py" "${FREEBSD_STAGE}/"
cp "${SCRIPT_DIR}/main.py" "${FREEBSD_STAGE}/"
cp "${SCRIPT_DIR}/requirements.txt" "${FREEBSD_STAGE}/"
cp "${SCRIPT_DIR}/__init__.py" "${FREEBSD_STAGE}/" 2>/dev/null || true

# Create virtualenv with dependencies (same as other platforms)
log "  Creating virtualenv with dependencies..."
python3 -m venv "${FREEBSD_STAGE}/venv"

VENV_PIP="${FREEBSD_STAGE}/venv/bin/pip"
VENV_PYTHON="${FREEBSD_STAGE}/venv/bin/python3"

# Upgrade pip and install setuptools
$VENV_PYTHON -m pip install --upgrade pip --quiet --no-index --find-links "${WHEEL_DIR}" 2>/dev/null || \
$VENV_PYTHON -m pip install --upgrade pip --quiet 2>/dev/null || true

$VENV_PIP install --no-index --find-links "${WHEEL_DIR}" setuptools wheel --quiet 2>/dev/null || \
$VENV_PIP install setuptools wheel --quiet 2>/dev/null || true

# Install requirements
$VENV_PIP install --no-index --find-links "${WHEEL_DIR}" -r "${SCRIPT_DIR}/requirements.txt" 2>/dev/null || \
$VENV_PIP install -r "${SCRIPT_DIR}/requirements.txt" 2>/dev/null || {
    error "Failed to install dependencies for FreeBSD"
}

# Verify installation
log "  Verifying dependencies..."
MISSING=""
for pkg in Flask prometheus_client psutil requests PyYAML; do
    if ! $VENV_PIP show "$pkg" >/dev/null 2>&1; then
        MISSING="${MISSING} ${pkg}"
    fi
done

if [[ -n "$MISSING" ]]; then
    error "Missing packages for FreeBSD:${MISSING}"
fi

# Test imports
if ! $VENV_PYTHON -c "import yaml; import requests; import flask" 2>/dev/null; then
    error "Import test failed for FreeBSD"
fi

# Create startup scripts that use bundled venv
cat > "${FREEBSD_STAGE}/start-agent.sh" << 'EOF'
#!/bin/sh
# PatchMaster Agent - FreeBSD (self-contained with bundled Python dependencies)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTROLLER_URL=${CONTROLLER_URL:-http://localhost:8000}
PORT=${PORT:-8080}
METRICS_PORT=${METRICS_PORT:-9100}
exec "${SCRIPT_DIR}/venv/bin/python3" "${SCRIPT_DIR}/agent.py" --port "$PORT" --metrics-port "$METRICS_PORT" --controller-url "$CONTROLLER_URL" "$@"
EOF
chmod +x "${FREEBSD_STAGE}/start-agent.sh"

cat > "${FREEBSD_STAGE}/start-heartbeat.sh" << 'EOF'
#!/bin/sh
# PatchMaster Agent Heartbeat - FreeBSD
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTROLLER_URL=${CONTROLLER_URL:-http://localhost:8000}
exec "${SCRIPT_DIR}/venv/bin/python3" "${SCRIPT_DIR}/main.py" "$@"
EOF
chmod +x "${FREEBSD_STAGE}/start-heartbeat.sh"

# Clean up venv to reduce size
rm -rf "${FREEBSD_STAGE}/venv/share" 2>/dev/null || true
find "${FREEBSD_STAGE}/venv" -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
find "${FREEBSD_STAGE}/venv" -name '*.pyc' -delete 2>/dev/null || true

cd "${FREEBSD_STAGE}"
tar -czf "${DIST_DIR}/patch-agent-${VERSION}-${ARCH}.freebsd.tar.gz" .
success "Built FreeBSD package with bundled dependencies"

# --- Create symlink to latest ---
cd "${DIST_DIR}"
ln -sf "patch-agent-${VERSION}-${ARCH}.deb" "agent-latest-${ARCH}.deb" 2>/dev/null || true
ln -sf "patch-agent-${VERSION}-${ARCH}.rhel.tar.gz" "agent-latest-${ARCH}.rhel.tar.gz" 2>/dev/null || true
ln -sf "patch-agent-${VERSION}-${ARCH}.arch.tar.gz" "agent-latest-${ARCH}.arch.tar.gz" 2>/dev/null || true
ln -sf "patch-agent-${VERSION}-${ARCH}.alpine.tar.gz" "agent-latest-${ARCH}.alpine.tar.gz" 2>/dev/null || true
ln -sf "patch-agent-${VERSION}-${ARCH}.freebsd.tar.gz" "agent-latest-${ARCH}.freebsd.tar.gz" 2>/dev/null || true

echo ""
echo "========================================"
echo "  Build Complete!"
echo "  Version: ${VERSION}"
echo "========================================"
echo ""
echo "Built packages:"
ls -lh "${DIST_DIR}"/patch-agent-${VERSION}.* 2>/dev/null || true
echo ""
echo "All packages include bundled Python dependencies."
echo "No internet required on target hosts."