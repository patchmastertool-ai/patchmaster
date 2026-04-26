#!/bin/bash
# PatchMaster Agent Uninstaller for Linux
set -e

echo "=== PatchMaster Agent Uninstaller ==="
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)" 
   exit 1
fi

# Confirmation prompt
read -p "Are you sure you want to uninstall PatchMaster Agent? (yes/no): " confirm
if [[ "$confirm" != "yes" ]]; then
    echo "Uninstall cancelled."
    exit 0
fi

echo ""
echo "[1/4] Stopping services..."
systemctl stop patch-agent.service 2>/dev/null || true
systemctl stop patch-agent-heartbeat.service 2>/dev/null || true
systemctl disable patch-agent.service 2>/dev/null || true
systemctl disable patch-agent-heartbeat.service 2>/dev/null || true

echo "[2/4] Removing package..."
if command -v rpm >/dev/null 2>&1; then
    # RPM-based (RHEL, CentOS, Amazon Linux, Fedora)
    if rpm -q patch-agent >/dev/null 2>&1; then
        if command -v dnf >/dev/null 2>&1; then
            dnf remove -y patch-agent
        else
            yum remove -y patch-agent
        fi
    fi
elif command -v dpkg >/dev/null 2>&1; then
    # DEB-based (Debian, Ubuntu)
    if dpkg -l | grep -q patch-agent; then
        apt-get remove -y patch-agent
        apt-get purge -y patch-agent
    fi
fi

echo "[3/4] Removing files and directories..."
rm -rf /opt/patch-agent
rm -rf /var/log/patch-agent
rm -rf /var/lib/patch-agent
rm -rf /etc/patch-agent
rm -f /usr/lib/systemd/system/patch-agent.service
rm -f /usr/lib/systemd/system/patch-agent-heartbeat.service
rm -f /usr/bin/patch-agent
rm -f /usr/bin/patch-agent-heartbeat
rm -f /usr/bin/patch-agent-uninstall

echo "[4/4] Reloading systemd..."
systemctl daemon-reload 2>/dev/null || true

echo ""
echo "✓ PatchMaster Agent has been successfully uninstalled."
echo ""
