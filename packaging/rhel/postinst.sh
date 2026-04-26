#!/bin/bash
set -e

# Create service user if not exists
if ! id -u patchagent >/dev/null 2>&1; then
    useradd -r -s /usr/sbin/nologin -d /opt/patch-agent patchagent 2>/dev/null || true
fi

# Create runtime directories
install -d -o patchagent -g patchagent /var/log/patch-agent
install -d -o patchagent -g patchagent /var/lib/patch-agent
install -d -o patchagent -g patchagent /var/lib/patch-agent/snapshots
install -d -o patchagent -g patchagent /var/lib/patch-agent/offline-pkgs
mkdir -p /etc/patch-agent
chown root:root /etc/patch-agent 2>/dev/null || true
chmod 755 /etc/patch-agent 2>/dev/null || true

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

/opt/patch-agent/selinux-apply.sh || true
