#!/bin/bash
###############################################################################
#  PatchMaster Vendor Portal — In-Place Update Script
#  Copies updated app.py and templates to the running install, then restarts.
#  Run from the repo vendor/ directory: sudo bash update-vendor.sh
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="/opt/patchmaster-vendor"
SVC_USER="pm-vendor"

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

[[ $EUID -ne 0 ]] && err "Run as root: sudo bash update-vendor.sh"
[[ -d "$INSTALL_DIR" ]] || err "$INSTALL_DIR not found. Run install-vendor.sh first."

log "Stopping pm-vendor service..."
systemctl stop pm-vendor 2>/dev/null || true

log "Copying updated app.py..."
cp "$SCRIPT_DIR/app.py" "$INSTALL_DIR/app.py"

log "Copying updated templates..."
cp -r "$SCRIPT_DIR/templates/"* "$INSTALL_DIR/templates/"

# Copy generate-license.py if present
[[ -f "$SCRIPT_DIR/generate-license.py" ]] && cp "$SCRIPT_DIR/generate-license.py" "$INSTALL_DIR/"

log "Fixing ownership..."
chown -R "$SVC_USER:$SVC_USER" "$INSTALL_DIR/app.py" "$INSTALL_DIR/templates/" 2>/dev/null || \
chown -R "$SVC_USER:$SVC_USER" "$INSTALL_DIR/" 2>/dev/null || true

log "Starting pm-vendor service..."
systemctl start pm-vendor

sleep 2
if systemctl is-active --quiet pm-vendor; then
    ok "pm-vendor is running."
    ok "Vendor portal updated successfully."
    echo ""
    PORT=$(grep -E 'listen [0-9]+' /etc/nginx/sites-available/pm-vendor 2>/dev/null | grep -oE '[0-9]+' | head -1 || echo "8081")
    echo "  Access: http://$(hostname -I | awk '{print $1}'):${PORT}"
else
    echo ""
    echo "Service failed to start. Check logs:"
    echo "  journalctl -u pm-vendor -n 30"
    exit 1
fi
