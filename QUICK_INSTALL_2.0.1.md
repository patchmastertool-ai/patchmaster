# Quick Installation Guide - PatchMaster 2.0.1

## Package Information

- **File:** `patchmaster-2.0.1.tar.gz`
- **Size:** 74.7 MB
- **Location:** `dist/patchmaster-2.0.1.tar.gz`
- **Checksum:** `dist/patchmaster-2.0.1.tar.gz.sha256`

## Fresh Installation (New Server)

### Step 1: Transfer Package to Server

```bash
# From your Windows machine, copy to Ubuntu server
scp dist/patchmaster-2.0.1.tar.gz root@172.24.1.254:/tmp/
scp dist/patchmaster-2.0.1.tar.gz.sha256 root@172.24.1.254:/tmp/
```

### Step 2: On Ubuntu Server

```bash
# SSH to server
ssh root@172.24.1.254

# Verify checksum
cd /tmp
sha256sum -c patchmaster-2.0.1.tar.gz.sha256

# Extract package
tar -xzf patchmaster-2.0.1.tar.gz
cd patchmaster-2.0.1

# Run installation
sudo bash packaging/install-bare.sh
```

The installer will:
- ✅ Install all dependencies
- ✅ Set up PostgreSQL database
- ✅ Configure nginx with WebSocket support
- ✅ Generate secure random passwords
- ✅ Install backend and frontend
- ✅ Start all services

### Step 3: Verify Installation

```bash
# Run diagnostics
sudo bash diagnose_agent_issues.sh

# Check services
systemctl status patchmaster-backend nginx postgresql

# Test API
curl http://127.0.0.1:8000/api/health
```

### Step 4: Access Web Interface

1. Open browser: `http://172.24.1.254:3000` (or port 80 if configured)
2. Login with default credentials (shown during installation)
3. Navigate to Groups & Tags page - should work without errors
4. Check browser console (F12) - no WebSocket errors

## Agent Installation

### Step 1: On Agent Machine

```bash
# Download agent package
curl -fsSL -o agent-latest.deb http://172.24.1.254:3000/download/agent-latest.deb

# Install agent
sudo dpkg -i agent-latest.deb || sudo apt-get install -f -y
```

### Step 2: Configure Agent

```bash
# Set controller URL
echo 'CONTROLLER_URL=http://172.24.1.254:8000' | sudo tee /etc/patch-agent/env

# Enable and start services
sudo systemctl enable --now patch-agent patch-agent-heartbeat

# Verify services
systemctl status patch-agent
systemctl status patch-agent-heartbeat
```

### Step 3: Verify Registration

```bash
# Check logs
journalctl -u patch-agent -n 20
journalctl -u patch-agent-heartbeat -n 20

# Should see "Registration successful" or "agent_token" in logs
```

### Step 4: Check in UI

1. Go to PatchMaster web interface
2. Navigate to Hosts page
3. Agent should appear within 1-2 minutes
4. Status should show "Online"

## Troubleshooting

### If Groups & Tags Page Fails

```bash
# On server
sudo bash fix_websocket_and_groups.sh

# Then in browser
# Clear cache (Ctrl+Shift+Delete)
# Reload page
```

### If Agent Not Appearing

```bash
# On agent machine
sudo bash fix_agent_registration.sh

# Or manually:
sudo systemctl restart patch-agent patch-agent-heartbeat
journalctl -u patch-agent -f
```

### If Installation Hangs

The new version provides clear feedback. If you see:
- "Database schema initialized successfully" - ✅ Good
- "Warning: Some database objects already exist" - ✅ Normal for upgrades
- "Error initializing database" - ❌ Check PostgreSQL

### Run Diagnostics

```bash
# On server
sudo bash diagnose_agent_issues.sh

# This will check:
# - Backend service status
# - Database connectivity
# - API endpoints
# - nginx configuration
# - WebSocket support
# - Network connectivity
```

## What's Fixed in 2.0.1

✅ WebSocket connections (Groups & Tags page)  
✅ Agent registration and visibility  
✅ Database initialization feedback  
✅ Secure password generation  
✅ Weak password detection (30 passwords)  
✅ Exception handling (20+ fixes)  
✅ Canary testing full rollout  

## Important Notes

1. **Passwords:** New installations use secure random passwords. Save them during installation!

2. **WebSocket:** nginx now properly configured for WebSocket connections. No manual configuration needed.

3. **Agents:** Use the fix script if agents don't appear: `fix_agent_registration.sh`

4. **Browser Cache:** Clear browser cache after installation to avoid JavaScript errors.

5. **Firewall:** Ensure ports 8000, 3000 (or 80/443) are accessible.

## Default Credentials

During installation, you'll see:
```
Admin username: admin
Admin password: [randomly generated]
```

**IMPORTANT:** Save these credentials! They are shown only once during installation.

## Post-Installation Checklist

### Server:
- [ ] Installation completed without errors
- [ ] Backend service running: `systemctl status patchmaster-backend`
- [ ] nginx service running: `systemctl status nginx`
- [ ] PostgreSQL service running: `systemctl status postgresql`
- [ ] API responding: `curl http://127.0.0.1:8000/api/health`
- [ ] Diagnostics pass: `bash diagnose_agent_issues.sh`

### Web Interface:
- [ ] Can access web interface
- [ ] Can login with admin credentials
- [ ] Dashboard loads correctly
- [ ] Groups & Tags page works (no WebSocket errors)
- [ ] Browser console (F12) shows no errors

### Agents:
- [ ] Agent package downloaded
- [ ] Agent installed successfully
- [ ] Services running: `systemctl status patch-agent patch-agent-heartbeat`
- [ ] Logs show successful registration
- [ ] Agent appears in Hosts page
- [ ] Agent status shows "Online"

## Support Files

All included in the package:

- `RELEASE_NOTES_2.0.1.md` - Complete release notes
- `DEPLOYMENT_FIXES.md` - Detailed troubleshooting guide
- `fix_websocket_and_groups.sh` - Fix WebSocket issues
- `fix_agent_registration.sh` - Fix agent registration
- `diagnose_agent_issues.sh` - Run diagnostics
- `fix_all_issues.sh` - General server fixes

## Quick Commands Reference

```bash
# Server - Check status
systemctl status patchmaster-backend nginx postgresql

# Server - View logs
journalctl -u patchmaster-backend -f

# Server - Run diagnostics
sudo bash diagnose_agent_issues.sh

# Server - Fix WebSocket
sudo bash fix_websocket_and_groups.sh

# Agent - Check status
systemctl status patch-agent patch-agent-heartbeat

# Agent - View logs
journalctl -u patch-agent -f

# Agent - Fix registration
sudo bash fix_agent_registration.sh

# Test connectivity (from agent)
curl http://172.24.1.254:8000/api/health
```

## Need Help?

1. Read `DEPLOYMENT_FIXES.md` for detailed troubleshooting
2. Run `diagnose_agent_issues.sh` for system diagnostics
3. Check logs: `journalctl -u patchmaster-backend -n 100`
4. Verify all services are running
5. Test network connectivity between agent and server

---

**Package:** patchmaster-2.0.1.tar.gz  
**Build Date:** 2026-04-16  
**All bugs from 2.0.0 are fixed in this release**
