#!/bin/bash
# Fix for PatchMaster Agent installation and registration
# Run this on the AGENT machine (not the server)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=================================="
echo "PatchMaster Agent - Fix & Register"
echo "==================================${NC}"
echo ""

# Get controller URL
read -p "Enter PatchMaster server IP (e.g., 172.24.1.254): " SERVER_IP
CONTROLLER_URL="http://${SERVER_IP}:8000"

echo ""
echo -e "${YELLOW}Using controller: $CONTROLLER_URL${NC}"
echo ""

# Fix 1: Set controller URL
echo -e "${YELLOW}Fix 1: Configuring controller URL...${NC}"
sudo mkdir -p /etc/patch-agent
echo "CONTROLLER_URL=$CONTROLLER_URL" | sudo tee /etc/patch-agent/env > /dev/null
echo -e "${GREEN}✓ Controller URL configured${NC}"
echo ""

# Fix 2: Enable and start services
echo -e "${YELLOW}Fix 2: Starting agent services...${NC}"
sudo systemctl daemon-reload
sudo systemctl enable patch-agent patch-agent-heartbeat
sudo systemctl restart patch-agent patch-agent-heartbeat
sleep 2
echo -e "${GREEN}✓ Services enabled and started${NC}"
echo ""

# Fix 3: Check service status
echo -e "${YELLOW}Fix 3: Checking service status...${NC}"
if systemctl is-active --quiet patch-agent; then
    echo -e "${GREEN}✓ patch-agent is running${NC}"
else
    echo -e "${RED}✗ patch-agent is not running${NC}"
    echo "Checking logs..."
    sudo journalctl -u patch-agent -n 20 --no-pager
fi

if systemctl is-active --quiet patch-agent-heartbeat; then
    echo -e "${GREEN}✓ patch-agent-heartbeat is running${NC}"
else
    echo -e "${RED}✗ patch-agent-heartbeat is not running${NC}"
    echo "Checking logs..."
    sudo journalctl -u patch-agent-heartbeat -n 20 --no-pager
fi
echo ""

# Fix 4: Test connectivity to controller
echo -e "${YELLOW}Fix 4: Testing connectivity to controller...${NC}"
if curl -s -o /dev/null -w "%{http_code}" "$CONTROLLER_URL/api/health" 2>/dev/null | grep -q "200\|404"; then
    echo -e "${GREEN}✓ Can reach controller at $CONTROLLER_URL${NC}"
else
    echo -e "${RED}✗ Cannot reach controller at $CONTROLLER_URL${NC}"
    echo "Please check:"
    echo "  - Server IP is correct"
    echo "  - Port 8000 is open on the server"
    echo "  - Backend service is running on the server"
fi
echo ""

# Fix 5: Check agent logs
echo -e "${YELLOW}Fix 5: Checking agent logs...${NC}"
if [ -f "/opt/patch-agent/logs/agent.log" ]; then
    ERRORS=$(sudo tail -n 20 /opt/patch-agent/logs/agent.log | grep -i "error\|exception" | tail -n 3)
    if [ -n "$ERRORS" ]; then
        echo -e "${YELLOW}Recent errors:${NC}"
        echo "$ERRORS"
    else
        echo -e "${GREEN}✓ No recent errors in agent log${NC}"
    fi
else
    echo -e "${YELLOW}Agent log not found yet${NC}"
fi
echo ""

# Summary
echo -e "${GREEN}=================================="
echo "Agent Status"
echo "==================================${NC}"
echo ""
echo "Configuration:"
echo "  Controller: $CONTROLLER_URL"
echo "  Config file: /etc/patch-agent/env"
echo ""
echo "Services:"
systemctl status patch-agent --no-pager -l | grep "Active:" || echo "  patch-agent: Unknown"
systemctl status patch-agent-heartbeat --no-pager -l | grep "Active:" || echo "  patch-agent-heartbeat: Unknown"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Check if agent appears in PatchMaster web UI (Hosts page)"
echo "2. If not visible, check server logs: sudo journalctl -u patchmaster-backend -f"
echo "3. Check agent logs: sudo tail -f /opt/patch-agent/logs/agent.log"
echo ""
