#!/bin/bash
# Fix agent virtualenv Python path issues
# Run this on the AGENT machine after installation

set -e

echo "=== Fixing PatchMaster Agent Virtualenv ==="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "[ERROR] Please run as root (sudo)"
    exit 1
fi

VENV_DIR="/opt/patch-agent/venv"

echo "[1/5] Stopping services..."
systemctl stop patch-agent patch-agent-heartbeat 2>/dev/null || true

echo "[2/5] Checking virtualenv..."
if [ ! -d "$VENV_DIR" ]; then
    echo "[ERROR] Virtualenv not found at $VENV_DIR"
    exit 1
fi

echo "[3/5] Fixing virtualenv paths..."

# Fix activate script
if [ -f "${VENV_DIR}/bin/activate" ]; then
    sed -i "s|VIRTUAL_ENV=.*|VIRTUAL_ENV=\"${VENV_DIR}\"|g" "${VENV_DIR}/bin/activate"
fi

# Fix all Python shebangs in venv/bin
find "${VENV_DIR}/bin" -type f 2>/dev/null | while read f; do
    if head -n 1 "$f" | grep -q "^#!.*python"; then
        sed -i "1s|^#!.*python.*|#!${VENV_DIR}/bin/python3|" "$f" 2>/dev/null || true
    fi
done

# Verify Python in venv works
if [ -f "${VENV_DIR}/bin/python3" ]; then
    echo "[4/5] Testing virtualenv Python..."
    if "${VENV_DIR}/bin/python3" -c "import sys; print(f'Python {sys.version}')" 2>/dev/null; then
        echo "  ✓ Python works"
    else
        echo "  ✗ Python test failed"
    fi
    
    # Test required packages
    echo "  Testing required packages..."
    for pkg in yaml requests flask psutil prometheus_client; do
        if "${VENV_DIR}/bin/python3" -c "import $pkg" 2>/dev/null; then
            echo "    ✓ $pkg"
        else
            echo "    ✗ $pkg MISSING"
        fi
    done
else
    echo "[ERROR] Python not found in virtualenv"
    exit 1
fi

echo "[5/5] Starting services..."
systemctl daemon-reload
systemctl start patch-agent
systemctl start patch-agent-heartbeat

sleep 3

echo ""
echo "=== Status Check ==="
systemctl status patch-agent --no-pager -l | head -10
echo ""
systemctl status patch-agent-heartbeat --no-pager -l | head -10

echo ""
echo "=== Recent Logs ==="
echo "Agent logs:"
journalctl -u patch-agent -n 5 --no-pager
echo ""
echo "Heartbeat logs:"
journalctl -u patch-agent-heartbeat -n 5 --no-pager

echo ""
echo "If still failing, the agent package needs to be rebuilt for your Python version."
echo "Your Python version: $(python3 --version)"
