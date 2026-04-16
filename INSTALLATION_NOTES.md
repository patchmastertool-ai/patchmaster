# Installation Notes

## Installation Progress

The installation script now provides clear progress feedback at each step. However, some steps may take several minutes depending on your system and internet connection.

### Expected Installation Times

| Step | Description | Typical Time | Notes |
|------|-------------|--------------|-------|
| Step 1 | Detecting OS | < 5 seconds | Fast |
| Step 2 | Installing system packages | 1-5 minutes | **May appear slow** |
| Step 3 | Creating service user | < 5 seconds | Fast |
| Step 4 | Setting up PostgreSQL | 30-60 seconds | Database initialization |
| Step 5 | Installing backend | 1-2 minutes | Python virtualenv creation |
| Step 6 | Installing frontend | 30-60 seconds | File copying |
| Step 7 | Configuring services | 30-60 seconds | systemd setup |
| Step 8 | Starting services | 30-60 seconds | Service startup |

**Total Time:** 5-15 minutes (depending on system speed and internet)

### Step 2: Installing System Packages

This step installs:
- Python 3 and development tools
- nginx web server
- PostgreSQL database
- gcc compiler and build tools
- Various utilities (curl, rsync, etc.)

**Why it takes time:**
- Downloading packages from Ubuntu/Debian repositories
- Installing dependencies
- Configuring packages

**Progress indicators:**
```
[+] Step 2/8: Installing system packages...
[+]   Installing base packages (python3, nginx, curl, gcc, etc.)...
[+]   Base packages installed
[+]   Installing PostgreSQL...
[+]   PostgreSQL installed
```

**If it seems stuck:**
1. **Wait 5 minutes** - apt-get can be slow on first run
2. **Check another terminal:**
   ```bash
   # In another SSH session
   ps aux | grep apt
   # Should show apt-get running
   
   tail -f /var/log/apt/term.log
   # Shows apt progress
   ```
3. **Check internet connection:**
   ```bash
   ping -c 3 archive.ubuntu.com
   ```

### Common Issues

#### Issue: "Step 2 not updating for 5+ minutes"

**Possible causes:**
1. Slow internet connection
2. Ubuntu repository mirrors are slow
3. apt lock held by another process

**Solutions:**

**Check if apt is actually running:**
```bash
# In another terminal
ps aux | grep apt-get
```

**Check for apt locks:**
```bash
sudo lsof /var/lib/dpkg/lock-frontend
sudo lsof /var/lib/apt/lists/lock
```

**If locked by another process:**
```bash
# Wait for other apt process to finish, or:
sudo killall apt apt-get
sudo rm /var/lib/apt/lists/lock
sudo rm /var/lib/dpkg/lock-frontend
sudo dpkg --configure -a
```

**Then restart installation:**
```bash
sudo ./install-bare.sh
```

#### Issue: "Installation hangs at PostgreSQL"

**Check PostgreSQL installation:**
```bash
# In another terminal
sudo tail -f /var/log/postgresql/postgresql-*.log
```

**If PostgreSQL fails to install:**
```bash
# Skip PGDG repository and use distro packages
export SKIP_PGDG=1
sudo ./install-bare.sh
```

#### Issue: "No internet connection"

If your server has no internet:

1. **Pre-download packages on another machine:**
   ```bash
   # On machine with internet
   apt-get download python3 python3-venv python3-pip python3-dev \
       nginx curl gcc make rsync zip unzip openssl samba \
       postgresql postgresql-contrib libpq-dev
   
   # Copy .deb files to server
   scp *.deb user@server:/tmp/packages/
   ```

2. **Install from local packages:**
   ```bash
   # On server
   cd /tmp/packages
   sudo dpkg -i *.deb
   sudo apt-get install -f -y
   ```

3. **Then run PatchMaster installation:**
   ```bash
   sudo ./install-bare.sh
   ```

### Monitoring Installation Progress

**Watch installation in real-time:**
```bash
# Run installation with verbose output
sudo bash -x ./install-bare.sh 2>&1 | tee install.log
```

**Check system logs:**
```bash
# apt logs
tail -f /var/log/apt/term.log

# System logs
journalctl -f

# Installation script output
tail -f install.log
```

### Installation on Slow Systems

If you have a slow system or internet connection:

1. **Be patient** - Step 2 can take 10-15 minutes on slow connections
2. **Don't interrupt** - Let apt-get finish completely
3. **Monitor progress** - Use the commands above to verify it's working
4. **Consider local mirror** - Set up a local Ubuntu mirror for faster installs

### Successful Installation

When installation completes successfully, you'll see:

```
[+] Step 8/8: Starting services...
[+]   Backend service started
[+]   nginx service started
[+]   PostgreSQL service started

╔══════════════════════════════════════════════════════════════╗
║                  Installation Complete!                      ║
╚══════════════════════════════════════════════════════════════╝

PatchMaster is now running!

  Web Interface: http://YOUR_SERVER_IP:3000
  Admin Username: admin
  Admin Password: [randomly generated]

  IMPORTANT: Save your admin password! It is shown only once.
```

### Post-Installation Verification

```bash
# Check services
systemctl status patchmaster-backend
systemctl status nginx
systemctl status postgresql

# Test API
curl http://127.0.0.1:8000/api/health

# Check logs
journalctl -u patchmaster-backend -n 50
```

### Getting Help

If installation fails:

1. **Save the logs:**
   ```bash
   sudo journalctl -xe > install-error.log
   sudo dmesg > dmesg.log
   ```

2. **Run diagnostics:**
   ```bash
   sudo bash diagnose_agent_issues.sh > diagnostics.txt
   ```

3. **Check common issues:**
   - Disk space: `df -h`
   - Memory: `free -h`
   - Ports in use: `netstat -tuln | grep -E ':(8000|3000|5432)'`

4. **Review documentation:**
   - `DEPLOYMENT_FIXES.md`
   - `QUICK_INSTALL_2.0.1.md`
   - `RELEASE_NOTES_2.0.1.md`

## Summary

- **Installation takes 5-15 minutes** - this is normal
- **Step 2 is the slowest** - installing system packages
- **Progress messages show it's working** - not hanging
- **Be patient** - don't interrupt apt-get
- **Monitor in another terminal** - if concerned
- **Check logs** - if something fails

The installation is designed to be reliable and provide clear feedback at each step.
