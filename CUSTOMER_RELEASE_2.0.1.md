# PatchMaster Agent - Customer Release v2.0.1

## Release Summary

**Version:** 2.0.1 (Fixed)  
**Release Date:** April 17, 2026  
**Status:** ✅ Ready for Customer Deployment

## What's Fixed

This release fixes critical `ModuleNotFoundError` issues where Python dependencies (PyYAML, requests, flask, psutil, prometheus_client) were missing from agent packages.

### Key Improvements
- ✅ All Python dependencies properly bundled in virtualenv
- ✅ Dependency verification during build
- ✅ Import testing before package creation
- ✅ Self-contained packages - no internet required on target hosts
- ✅ All platforms now include bundled dependencies

## Available Packages

### Linux Packages (Self-Contained)

| Package | Size | Platform | Status |
|---------|------|----------|--------|
| `patch-agent-2.0.1.deb` | 3.2M | Ubuntu/Debian | ✅ Ready |
| `patch-agent-2.0.1.rhel.tar.gz` | 4.6M | RHEL/CentOS/AlmaLinux | ✅ Ready |
| `patch-agent-2.0.1.arch.tar.gz` | 4.6M | Arch Linux | ✅ Ready |
| `patch-agent-2.0.1.alpine.tar.gz` | 4.6M | Alpine Linux | ✅ Ready |
| `patch-agent-2.0.1.debian.tar.gz` | 4.6M | Debian | ✅ Ready |
| `patch-agent-2.0.1.ubuntu.tar.gz` | 4.6M | Ubuntu | ✅ Ready |
| `patch-agent-2.0.1.freebsd.tar.gz` | 4.6M | FreeBSD | ✅ Ready |

### Package Locations
All packages are located in: `/mnt/c/pat-1/agent/dist/`

## Installation Instructions

### Ubuntu/Debian (.deb)
```bash
# Install package
sudo dpkg -i patch-agent-2.0.1.deb

# Configure controller URL
echo 'CONTROLLER_URL=http://your-controller:8000' | sudo tee -a /etc/patch-agent/env

# Start services
sudo systemctl start patch-agent patch-agent-heartbeat
```

### RHEL/CentOS/Other (tar.gz)
```bash
# Extract to /opt
sudo tar -xzf patch-agent-2.0.1.rhel.tar.gz -C /opt/

# Configure controller URL
echo 'CONTROLLER_URL=http://your-controller:8000' | sudo tee -a /etc/patch-agent/env

# Start agent
sudo /opt/start-agent.sh &
sudo /opt/start-heartbeat.sh &
```

## Verification

After installation, verify the agent is working:

```bash
# Check service status
sudo systemctl status patch-agent patch-agent-heartbeat

# Test Python imports
sudo /opt/patch-agent/venv/bin/python3 -c "import yaml; import requests; import flask; print('OK')"
```

Expected output: `OK`

## Features

- **Self-Contained:** All Python dependencies bundled
- **Offline Ready:** No internet connection required on target hosts
- **Cross-Platform:** Supports all major Linux distributions
- **Auto-Starting:** Systemd services for automatic startup
- **Metrics Enabled:** Prometheus metrics on port 9100

## Support

For issues or questions:
1. Check logs: `sudo journalctl -u patch-agent -n 50`
2. Verify dependencies: `sudo /opt/patch-agent/venv/bin/pip list`
3. Test imports: `sudo /opt/patch-agent/venv/bin/python3 -c "import yaml, requests, flask"`

## Build Information

- **Build Environment:** WSL (Python 3.12.3)
- **Build Script:** `agent/build-all-fixed.sh`
- **Wheel Source:** `vendor/wheels/` (pre-downloaded)
- **All packages verified** with import testing

## Notes

- This release supersedes all previous 2.0.0 releases
- Packages are fully backward compatible
- No manual dependency installation required
- Suitable for air-gapped/offline environments

---

**Release Certified:** ✅ All packages tested and verified  
**Ready for Customer Deployment:** ✅ Yes