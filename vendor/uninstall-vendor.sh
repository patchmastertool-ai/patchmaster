#!/bin/bash
###############################################################################
# PatchMaster by VYGROUP — Vendor Portal Uninstaller (Ubuntu/Debian/RHEL)
###############################################################################
set -euo pipefail

INSTALL_DIR="/opt/patchmaster-vendor"
SVC="pm-vendor"
NGINX_SITE="/etc/nginx/sites-available/pm-vendor"
NGINX_LINK="/etc/nginx/sites-enabled/pm-vendor"
SVC_USER="pm-vendor"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log(){ echo -e "${GREEN}[+]${NC} $*"; }
warn(){ echo -e "${YELLOW}[!]${NC} $*"; }
err(){ echo -e "${RED}[x]${NC} $*" >&2; }

banner() {
    echo -e "${BLUE}"
    cat <<'ART'
  ____       _       _       _       __  __
 |  _ \ __ _| |_ ___| |__   | |\/|  / _|/ _|
 | |_) / _` | __/ __| '_ \  | |  | | |_| |_
 |  __/ (_| | || (__| | | | | |  | |  _|  _|
 |_|   \__,_|\__\___|_| |_| |_|  |_|_| |_|
ART
    echo -e "${NC}"
    echo "       PatchMaster by VYGROUP"
    echo "       Vendor Portal Uninstaller"
    echo
}

if [[ $EUID -ne 0 ]]; then
  err "Run as root (sudo)."
  exit 1
fi

banner

log "Stopping vendor service (if running)..."
if systemctl list-unit-files | grep -q "^${SVC}.service"; then
  systemctl stop "${SVC}.service" 2>/dev/null || true
  systemctl disable "${SVC}.service" 2>/dev/null || true
  rm -f "/etc/systemd/system/${SVC}.service"
  systemctl daemon-reload
else
  warn "Service ${SVC} not found; skipping."
fi

log "Removing nginx site..."
rm -f "$NGINX_LINK" "$NGINX_SITE" || true
if systemctl is-active nginx >/dev/null 2>&1; then
  nginx -t && systemctl restart nginx || warn "nginx restart failed (check manually)."
fi

log "Removing installation directory $INSTALL_DIR ..."
rm -rf "$INSTALL_DIR"

log "Removing user/group if unused..."
if id "$SVC_USER" &>/dev/null; then
  if ! pgrep -u "$SVC_USER" >/dev/null 2>&1; then
    deluser "$SVC_USER" 2>/dev/null || true
  else
    warn "User $SVC_USER still has running processes; not deleted."
  fi
fi
if getent group "$SVC_USER" >/dev/null 2>&1; then
  delgroup "$SVC_USER" 2>/dev/null || true
fi

log "Uninstall complete."
