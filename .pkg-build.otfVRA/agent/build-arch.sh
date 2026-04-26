#!/bin/bash
###############################################################################
# PatchMaster Agent - Arch Linux Package Builder
# Creates .pkg.tar.zst package for Arch Linux
###############################################################################

set -euo pipefail

VERSION="${1:-2.0.0}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/dist/arch-build"
PKG_NAME="patchmaster-agent"
PKG_FILE="${PKG_NAME}-${VERSION}-1-any.pkg.tar.zst"

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

log "Building Arch Linux package for PatchMaster Agent v${VERSION}"

# Clean and create build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"/{opt/patch-agent,etc/patch-agent,etc/systemd/system,usr/share/doc/patchmaster-agent}

# Copy agent files
log "Copying agent files..."
cp "$SCRIPT_DIR"/agent.py "$BUILD_DIR/opt/patch-agent/"
cp "$SCRIPT_DIR"/main.py "$BUILD_DIR/opt/patch-agent/"
cp "$SCRIPT_DIR"/requirements.txt "$BUILD_DIR/opt/patch-agent/"

# Create bundled virtualenv (for air-gapped support)
log "Creating bundled virtualenv..."
python3 -m venv "$BUILD_DIR/opt/patch-agent/venv"

# Install dependencies into venv
log "Installing Python dependencies..."
VENV_PIP="$BUILD_DIR/opt/patch-agent/venv/bin/pip"

# Use local wheels only (air-gapped build)
if [[ -d "/workspace/vendor/wheels" ]]; then
    log "Using wheels from /workspace/vendor/wheels..."
    $VENV_PIP install --upgrade pip wheel setuptools --no-index --find-links /workspace/vendor/wheels 2>/dev/null || true
    $VENV_PIP install --no-index --find-links /workspace/vendor/wheels -r "$SCRIPT_DIR/requirements.txt"
elif [[ -d "$PROJECT_ROOT/vendor/wheels" ]]; then
    log "Using wheels from vendor..."
    $VENV_PIP install --upgrade pip wheel setuptools --no-index --find-links "$PROJECT_ROOT/vendor/wheels" 2>/dev/null || true
    $VENV_PIP install --no-index --find-links "$PROJECT_ROOT/vendor/wheels" -r "$SCRIPT_DIR/requirements.txt"
else
    log "ERROR: No wheels directory found! Air-gapped build requires vendor/wheels/"
    exit 1
fi

# Clean up venv to reduce size (use -f to force, ignore errors)
log "Cleaning up virtualenv..."
rm -rf "$BUILD_DIR/opt/patch-agent/venv/share" 2>/dev/null || true
find "$BUILD_DIR/opt/patch-agent/venv" -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
find "$BUILD_DIR/opt/patch-agent/venv" -type f -name '*.pyc' -delete 2>/dev/null || true
find "$BUILD_DIR/opt/patch-agent/venv" -type f -name '*.pyo' -delete 2>/dev/null || true

# Create run scripts
log "Creating run scripts..."
cat > "$BUILD_DIR/opt/patch-agent/run-heartbeat.sh" <<'EOF'
#!/bin/bash
source /etc/patch-agent/env 2>/dev/null || true
exec /opt/patch-agent/venv/bin/python3 /opt/patch-agent/main.py
EOF

cat > "$BUILD_DIR/opt/patch-agent/run-api.sh" <<'EOF'
#!/bin/bash
source /etc/patch-agent/env 2>/dev/null || true
AGENT_PORT="${AGENT_PORT:-8080}"
METRICS_PORT="${METRICS_PORT:-9100}"
exec /opt/patch-agent/venv/bin/python3 /opt/patch-agent/agent.py \
    --port "$AGENT_PORT" \
    --metrics-port "$METRICS_PORT"
EOF

chmod +x "$BUILD_DIR/opt/patch-agent"/*.sh

# Create systemd service files
log "Creating systemd service files..."
cat > "$BUILD_DIR/etc/systemd/system/patch-agent.service" <<'EOF'
[Unit]
Description=PatchMaster Agent - Heartbeat
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
EnvironmentFile=/etc/patch-agent/env
ExecStart=/opt/patch-agent/run-heartbeat.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

cat > "$BUILD_DIR/etc/systemd/system/patch-agent-api.service" <<'EOF'
[Unit]
Description=PatchMaster Agent - API Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
EnvironmentFile=/etc/patch-agent/env
ExecStart=/opt/patch-agent/run-api.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Create default config
cat > "$BUILD_DIR/etc/patch-agent/env" <<'EOF'
CONTROLLER_URL=http://localhost:8000
AGENT_PORT=8080
METRICS_PORT=9100
EOF

# Create .PKGINFO
log "Creating package metadata..."
cat > "$BUILD_DIR/.PKGINFO" <<EOF
pkgname = $PKG_NAME
pkgver = $VERSION-1
pkgdesc = PatchMaster Agent - Universal patch management agent
url = https://github.com/VYGROUP/patchmaster
builddate = $(date +%s)
packager = PatchMaster Build System
size = $(du -sb "$BUILD_DIR" | cut -f1)
arch = any
license = MIT
depend = python
depend = python-pip
depend = systemd
EOF

# Create .INSTALL script
cat > "$BUILD_DIR/.INSTALL" <<'EOF'
post_install() {
    echo "Setting up PatchMaster Agent..."
    
    # Virtualenv is already bundled, just enable services
    systemctl daemon-reload
    systemctl enable patch-agent.service patch-agent-api.service
    systemctl start patch-agent.service patch-agent-api.service
    
    echo "PatchMaster Agent installed successfully!"
    echo "Check status: systemctl status patch-agent"
}

post_upgrade() {
    systemctl daemon-reload
    systemctl restart patch-agent.service patch-agent-api.service 2>/dev/null || true
}

pre_remove() {
    systemctl stop patch-agent.service patch-agent-api.service 2>/dev/null || true
    systemctl disable patch-agent.service patch-agent-api.service 2>/dev/null || true
}

post_remove() {
    echo "PatchMaster Agent removed"
}
EOF

# Create package
log "Creating package archive..."
cd "$BUILD_DIR"

# Create .MTREE file properly
bsdtar -czf .MTREE --format=mtree \
    --options='!all,use-set,type,uid,gid,mode,time,size,md5,sha256,link' \
    opt etc usr 2>/dev/null || {
    log "Warning: Could not create .MTREE, creating without it"
    tar -cf - .PKGINFO .INSTALL opt etc usr | zstd -19 -T0 > "$SCRIPT_DIR/dist/$PKG_FILE"
    success "Package created: $SCRIPT_DIR/dist/$PKG_FILE"
    cd "$SCRIPT_DIR/dist"
    ln -sf "$PKG_FILE" "agent-latest.pkg.tar.zst"
    success "Symlink created: agent-latest.pkg.tar.zst"
    if [[ -d "$PROJECT_ROOT/backend/static" ]]; then
        cp "$SCRIPT_DIR/dist/$PKG_FILE" "$PROJECT_ROOT/backend/static/agent-latest.pkg.tar.zst"
        success "Copied to backend/static/"
    fi
    log "Arch Linux package build complete!"
    exit 0
}

tar -cf - .MTREE .PKGINFO .INSTALL opt etc usr | zstd -19 -T0 > "$SCRIPT_DIR/dist/$PKG_FILE"

success "Package created: $SCRIPT_DIR/dist/$PKG_FILE"

# Create symlink
cd "$SCRIPT_DIR/dist"
ln -sf "$PKG_FILE" "agent-latest.pkg.tar.zst"
success "Symlink created: agent-latest.pkg.tar.zst"

# Copy to backend/static
if [[ -d "$PROJECT_ROOT/backend/static" ]]; then
    cp "$SCRIPT_DIR/dist/$PKG_FILE" "$PROJECT_ROOT/backend/static/agent-latest.pkg.tar.zst"
    success "Copied to backend/static/"
fi

log "Arch Linux package build complete!"
log "Install with: sudo pacman -U $PKG_FILE"
