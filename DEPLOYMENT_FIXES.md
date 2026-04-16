# PatchMaster Deployment Fixes

This document describes the fix scripts available to resolve common deployment issues.

## Quick Reference

| Issue | Script | Run On | Description |
|-------|--------|--------|-------------|
| WebSocket connection failed | `fix_websocket_and_groups.sh` | Server | Fixes Groups & Tags page and WebSocket connections |
| Agent not appearing in UI | `fix_agent_registration.sh` | Agent | Fixes agent registration and connectivity |
| General diagnostics | `diagnose_agent_issues.sh` | Server | Comprehensive system diagnostics |
| All installation issues | `fix_all_issues.sh` | Server | Comprehensive server-side fixes |

## Issues Fixed in This Release

### 1. Database Initialization Feedback ✅
**Status:** Fixed in `backend/database.py`

The database initialization now provides clear feedback:
- Success message when schema is created
- Warning message when schema already exists (upgrades)
- Error messages for actual failures

No action needed - this is automatic.

### 2. Bare Exception Clauses ✅
**Status:** Fixed in multiple files

All bare `except:` clauses have been replaced with specific exception types:
- File operations: `except (IOError, OSError):`
- JSON parsing: `except (json.JSONDecodeError, ValueError):`
- Disk operations: `except (OSError, PermissionError):`

Files fixed:
- `agent/agent.py` (15 instances)
- `agent/solaris_manager.py`
- `agent/aix_manager.py`
- `agent/hpux_manager.py`
- `agent/patchrepo_api.py`
- `backend/api/agent_proxy.py`

### 3. Hardcoded Default Passwords ✅
**Status:** Fixed in `packaging/install-bare.sh`

Default passwords now use secure random generation:
- PostgreSQL: `PgPm!7` + 16 random hex chars
- Grafana: `GfA!7` + 16 random hex chars

Example: `PgPm!7a3f8e9c1d2b4567`

### 4. Weak Password Detection ✅
**Status:** Fixed in `vendor/app.py`

Expanded weak password list from 6 to 30 common passwords including:
- password123, admin1, root, toor
- qwerty, abc123, letmein, welcome
- monkey, dragon, master, sunshine
- And 18 more common weak passwords

### 5. Canary Testing Full Rollout ✅
**Status:** Fixed in `backend/api/canary_testing.py`

Implemented the TODO comment for full rollout:
- Created `_trigger_full_rollout()` function
- Automatically deploys to remaining hosts after canary success
- Includes error handling and logging
- Stores rollout metadata

### 6. WebSocket Connection Issues ✅
**Status:** Fixed in `packaging/install-bare.sh`

Added missing WebSocket proxy headers to nginx:
- `proxy_http_version 1.1`
- `proxy_set_header Upgrade $http_upgrade`
- `proxy_set_header Connection "upgrade"`
- Increased timeouts for long-lived connections

**Fix Script:** `fix_websocket_and_groups.sh`

### 7. Groups & Tags Page Failure ✅
**Status:** Fixed (related to WebSocket issue)

The Groups & Tags page was failing due to WebSocket connection errors. This is now fixed with the nginx configuration updates.

## Fix Scripts

### 1. fix_websocket_and_groups.sh

**Purpose:** Fix WebSocket connections and Groups & Tags page

**Run on:** PatchMaster server (172.24.1.254)

**What it does:**
1. Backs up nginx configuration
2. Adds WebSocket proxy headers if missing
3. Tests nginx configuration
4. Reloads nginx
5. Verifies backend service
6. Tests API endpoints
7. Checks registered agents

**Usage:**
```bash
# On PatchMaster server
sudo bash fix_websocket_and_groups.sh
```

**After running:**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Reload PatchMaster web interface
3. Navigate to Groups & Tags page
4. Check browser console (F12) for errors

### 2. fix_agent_registration.sh

**Purpose:** Fix agent registration and visibility issues

**Run on:** Agent machine (not the server)

**What it does:**
1. Tests connectivity to PatchMaster server
2. Verifies agent installation
3. Configures CONTROLLER_URL
4. Stops and restarts agent services
5. Verifies registration and heartbeat
6. Provides troubleshooting guidance

**Usage:**
```bash
# On agent machine
sudo bash fix_agent_registration.sh
```

The script will prompt for the PatchMaster server IP if not already configured.

**After running:**
1. Check PatchMaster UI - host should appear in Hosts page
2. If not visible, run diagnostics on server
3. Check agent logs: `journalctl -u patch-agent -f`

### 3. diagnose_agent_issues.sh

**Purpose:** Comprehensive diagnostics for agent and system issues

**Run on:** PatchMaster server

**What it does:**
1. Checks backend service status
2. Tests database connectivity
3. Queries host counts from database
4. Tests all API endpoints
5. Validates nginx configuration
6. Checks WebSocket endpoint
7. Verifies network connectivity
8. Shows recent backend logs

**Usage:**
```bash
# On PatchMaster server
sudo bash diagnose_agent_issues.sh
```

**Output includes:**
- Color-coded status indicators
- Database query results
- API endpoint test results
- Common issues and solutions

### 4. fix_all_issues.sh

**Purpose:** Comprehensive server-side fixes (from previous session)

**Run on:** PatchMaster server

**What it does:**
1. Fixes database initialization feedback
2. Sets proper file permissions
3. Verifies PostgreSQL connection
4. Restarts backend service
5. Checks logs for errors
6. Verifies agent package
7. Tests API endpoints

**Usage:**
```bash
# On PatchMaster server
sudo bash fix_all_issues.sh
```

## Common Issues & Solutions

### Issue: Groups & Tags page shows "WebSocket connection failed"

**Cause:** nginx missing WebSocket proxy headers

**Solution:**
```bash
sudo bash fix_websocket_and_groups.sh
# Then clear browser cache and reload
```

### Issue: Agent installed but not appearing in UI

**Causes:**
1. CONTROLLER_URL not set or incorrect
2. Agent services not running
3. Network connectivity issues
4. Firewall blocking connections

**Solution:**
```bash
# On agent machine
sudo bash fix_agent_registration.sh

# On server (for diagnostics)
sudo bash diagnose_agent_issues.sh
```

**Manual verification:**
```bash
# On agent machine
cat /etc/patch-agent/env
systemctl status patch-agent
systemctl status patch-agent-heartbeat
curl http://172.24.1.254:8000/api/health
journalctl -u patch-agent -n 50
```

### Issue: "Failed to create group" or Groups API errors

**Cause:** Backend service issues or database problems

**Solution:**
```bash
# Run diagnostics first
sudo bash diagnose_agent_issues.sh

# Check backend logs
journalctl -u patchmaster-backend -n 50

# Restart backend if needed
sudo systemctl restart patchmaster-backend
```

### Issue: Database initialization hanging

**Cause:** Database connection timeout or schema conflicts

**Solution:**
The database initialization now handles this gracefully with:
- Timeout protection
- Duplicate object detection
- Clear status messages

If still having issues:
```bash
# Check PostgreSQL
sudo systemctl status postgresql

# Test connection
sudo -u postgres psql -d patchmaster -c "SELECT 1;"

# Check backend logs
journalctl -u patchmaster-backend -n 100
```

## Deployment Checklist

### On PatchMaster Server:

1. ✅ Run comprehensive fixes:
   ```bash
   sudo bash fix_all_issues.sh
   ```

2. ✅ Fix WebSocket connections:
   ```bash
   sudo bash fix_websocket_and_groups.sh
   ```

3. ✅ Run diagnostics:
   ```bash
   sudo bash diagnose_agent_issues.sh
   ```

4. ✅ Verify services:
   ```bash
   systemctl status patchmaster-backend
   systemctl status nginx
   systemctl status postgresql
   ```

5. ✅ Test API endpoints:
   ```bash
   curl http://127.0.0.1:8000/api/health
   curl http://127.0.0.1:8000/api/groups/
   curl http://127.0.0.1:8000/api/hosts/
   ```

### On Agent Machines:

1. ✅ Download and install agent:
   ```bash
   curl -fsSL -o agent-latest.deb http://172.24.1.254:3000/download/agent-latest.deb
   sudo dpkg -i agent-latest.deb || sudo apt-get install -f -y
   ```

2. ✅ Run registration fix:
   ```bash
   sudo bash fix_agent_registration.sh
   ```

3. ✅ Verify services:
   ```bash
   systemctl status patch-agent
   systemctl status patch-agent-heartbeat
   ```

4. ✅ Check logs:
   ```bash
   journalctl -u patch-agent -n 20
   journalctl -u patch-agent-heartbeat -n 20
   ```

### In Web Browser:

1. ✅ Clear browser cache (Ctrl+Shift+Delete)
2. ✅ Reload PatchMaster interface
3. ✅ Check browser console (F12) for errors
4. ✅ Navigate to Groups & Tags page
5. ✅ Verify hosts appear in Hosts page
6. ✅ Test creating a group

## Troubleshooting Commands

### Server-side:
```bash
# Backend logs
journalctl -u patchmaster-backend -f

# nginx logs
tail -f /var/log/nginx/error.log

# Database connection
sudo -u postgres psql -d patchmaster -c "SELECT COUNT(*) FROM hosts;"

# Check ports
netstat -tuln | grep -E ':(8000|3000|80|443)'

# Test API
curl -v http://127.0.0.1:8000/api/health
```

### Agent-side:
```bash
# Agent logs
journalctl -u patch-agent -f
journalctl -u patch-agent-heartbeat -f

# Configuration
cat /etc/patch-agent/env

# Test connectivity
curl http://172.24.1.254:8000/api/health

# Service status
systemctl status patch-agent patch-agent-heartbeat
```

### Browser:
```
F12 → Console tab → Look for errors
F12 → Network tab → Filter: WS → Check WebSocket connections
```

## Files Modified

### Backend:
- `backend/database.py` - Database initialization feedback
- `backend/api/canary_testing.py` - Full rollout implementation
- `backend/api/register_v2.py` - Agent registration (already correct)
- `backend/api/groups.py` - Groups API (already correct)
- `backend/api/notifications.py` - WebSocket endpoint (already correct)

### Agent:
- `agent/agent.py` - Fixed bare exceptions
- `agent/solaris_manager.py` - Fixed bare exceptions
- `agent/aix_manager.py` - Fixed bare exceptions
- `agent/hpux_manager.py` - Fixed bare exceptions
- `agent/patchrepo_api.py` - Fixed bare exceptions

### Installation:
- `packaging/install-bare.sh` - WebSocket headers, secure passwords

### Vendor:
- `vendor/app.py` - Expanded weak password list

### Fix Scripts (New):
- `fix_websocket_and_groups.sh` - WebSocket and Groups fixes
- `fix_agent_registration.sh` - Agent registration fixes
- `diagnose_agent_issues.sh` - Comprehensive diagnostics
- `fix_all_issues.sh` - General server fixes (from previous session)

## Support

If issues persist after running all fix scripts:

1. Collect diagnostics:
   ```bash
   sudo bash diagnose_agent_issues.sh > diagnostics.txt
   journalctl -u patchmaster-backend -n 200 > backend.log
   journalctl -u patch-agent -n 200 > agent.log
   ```

2. Check the logs for specific error messages

3. Verify all services are running:
   ```bash
   systemctl status patchmaster-backend nginx postgresql patch-agent patch-agent-heartbeat
   ```

4. Test network connectivity between agent and server

5. Verify firewall rules allow traffic on ports 8000, 3000, 80, 443
