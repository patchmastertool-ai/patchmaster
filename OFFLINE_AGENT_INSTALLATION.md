# Offline Agent Installation Guide

This guide explains how to build and install PatchMaster agents on systems without internet access.

## Problem

By default, the agent build process may try to download Python packages from PyPI during installation. This fails on air-gapped or offline systems.

## Solution

The agent package now includes all Python dependencies bundled in a self-contained virtualenv. No internet required on target hosts.

## Building Offline-Ready Agent Package

### Prerequisites (on build machine with internet):

- Python 3.8 or higher
- pip3
- dpkg-deb (for Debian/Ubuntu packages)
- Internet connection (only during build)

### Step 1: Download All Python Wheels

On a machine with internet access:

```bash
# Download all required Python packages
cd agent
bash download-wheels.sh
```

This downloads all dependencies to `vendor/wheels/`:
- Flask
- prometheus_client
- psutil
- requests
- PyYAML
- All transitive dependencies

**Output:**
```
Downloaded wheels: 15+
Total size: ~5-10 MB
Location: vendor/wheels/
```

### Step 2: Build Agent Package

```bash
# Build the .deb package with bundled dependencies
bash agent/build-deb.sh
```

The build script will:
1. Create a Python virtualenv
2. Install all dependencies from local wheels (no internet)
3. Bundle everything into `/opt/patch-agent/venv`
4. Create a self-contained .deb package

**Output:**
```
Package: backend/static/agent-latest.deb
Size: ~30-40 MB (includes Python virtualenv + all dependencies)
```

### Step 3: Verify Offline Capability

```bash
# Test that all dependencies are bundled
dpkg-deb -c backend/static/agent-latest.deb | grep -E "venv|\.whl"
```

You should see:
- `/opt/patch-agent/venv/` directory
- All Python packages installed in the venv
- No external dependencies required

## Installing Agent on Offline Systems

### Method 1: Via PatchMaster Server (Recommended)

The agent package is automatically served by PatchMaster:

```bash
# On agent machine (offline)
curl -fsSL -o agent-latest.deb http://PATCHMASTER_IP:3000/download/agent-latest.deb
sudo dpkg -i agent-latest.deb
```

### Method 2: Manual Transfer

If the agent machine can't reach PatchMaster server:

```bash
# On build machine, copy package to agent
scp backend/static/agent-latest.deb user@agent-machine:/tmp/

# On agent machine
sudo dpkg -i /tmp/agent-latest.deb
```

### Method 3: USB/Removable Media

For completely air-gapped systems:

1. Copy `agent-latest.deb` to USB drive
2. Transfer to agent machine
3. Install: `sudo dpkg -i /path/to/agent-latest.deb`

## Configuration

After installation, configure the agent:

```bash
# Set PatchMaster server URL
echo 'CONTROLLER_URL=http://PATCHMASTER_IP:8000' | sudo tee /etc/patch-agent/env

# Enable and start services
sudo systemctl enable --now patch-agent patch-agent-heartbeat

# Verify services
systemctl status patch-agent
systemctl status patch-agent-heartbeat
```

## Verification

### Check Dependencies

```bash
# Verify virtualenv exists
ls -la /opt/patch-agent/venv/

# Check installed packages
/opt/patch-agent/venv/bin/pip list

# Should show:
# Flask, prometheus-client, psutil, requests, PyYAML
```

### Test Agent

```bash
# Check logs
journalctl -u patch-agent -n 20
journalctl -u patch-agent-heartbeat -n 20

# Should see:
# "Registration successful" or "agent_token"
# No errors about missing Python packages
```

## Troubleshooting

### Issue: "ModuleNotFoundError: No module named 'flask'"

**Cause:** Dependencies not bundled in package

**Solution:**
1. Rebuild agent with wheels:
   ```bash
   bash agent/download-wheels.sh
   bash agent/build-deb.sh
   ```
2. Verify wheels exist: `ls vendor/wheels/`
3. Reinstall agent package

### Issue: "pip: command not found" during installation

**Cause:** Agent trying to download packages during install

**Solution:**
The new build script bundles everything. Rebuild with:
```bash
bash agent/build-deb.sh
```

Verify the package includes venv:
```bash
dpkg-deb -c backend/static/agent-latest.deb | grep venv
```

### Issue: Agent package too large

**Normal:** 30-40 MB is expected for self-contained package

The package includes:
- Python virtualenv (~15 MB)
- All dependencies (~10 MB)
- Agent code (~5 MB)

This is necessary for offline operation.

## Package Contents

The self-contained agent package includes:

```
/opt/patch-agent/
├── venv/                    # Python virtualenv with all dependencies
│   ├── bin/
│   │   ├── python3
│   │   ├── pip
│   │   └── ...
│   └── lib/
│       └── python3.X/
│           └── site-packages/
│               ├── flask/
│               ├── prometheus_client/
│               ├── psutil/
│               ├── requests/
│               ├── yaml/
│               └── ...
├── agent.py                 # Agent API server
├── main.py                  # Heartbeat service
├── requirements.txt         # Dependency list (for reference)
├── run-api.sh              # Wrapper script for API
└── run-heartbeat.sh        # Wrapper script for heartbeat

/etc/patch-agent/
└── env                      # Configuration file

/lib/systemd/system/
├── patch-agent.service
└── patch-agent-heartbeat.service

/usr/bin/
├── patch-agent
└── patch-agent-heartbeat
```

## Dependencies

### Bundled (no internet required):
- Python 3.8+ virtualenv
- Flask (web framework)
- prometheus_client (metrics)
- psutil (system info)
- requests (HTTP client)
- PyYAML (config parsing)
- All transitive dependencies

### System Requirements (must be pre-installed):
- Python 3.8 or higher (system package)
- systemd (for service management)
- Basic Linux utilities (bash, etc.)

On Debian/Ubuntu, Python 3 is usually pre-installed. If not:
```bash
# Install Python 3 (requires internet or local repository)
sudo apt-get install python3
```

## Building for Different Platforms

### Debian/Ubuntu (.deb)
```bash
bash agent/build-deb.sh
```

### RHEL/CentOS (.rpm)
```bash
bash agent/build-rpm.sh
```

### FreeBSD
```bash
bash agent/build-freebsd.sh
```

### Solaris
```bash
bash agent/build-solaris.sh
```

### AIX
```bash
bash agent/build-aix.sh
```

All build scripts support offline mode with bundled wheels.

## Updating Wheels

To update Python dependencies:

```bash
# Update requirements.txt with new versions
vim agent/requirements.txt

# Download new wheels
bash agent/download-wheels.sh

# Rebuild agent
bash agent/build-deb.sh
```

## Best Practices

1. **Always download wheels before building:**
   ```bash
   bash agent/download-wheels.sh
   bash agent/build-deb.sh
   ```

2. **Verify offline capability:**
   ```bash
   # Disconnect internet and try building
   # Should work without errors
   ```

3. **Test on offline system:**
   - Install on a VM without internet
   - Verify all services start
   - Check logs for errors

4. **Keep wheels updated:**
   - Re-download wheels monthly
   - Update for security patches
   - Test new versions before deployment

5. **Document your build:**
   - Note Python version used
   - Record wheel versions
   - Keep build logs

## Security Considerations

### Wheel Verification

Verify wheel integrity:
```bash
# Check wheel signatures (if available)
pip3 verify vendor/wheels/*.whl

# Verify checksums
sha256sum vendor/wheels/*.whl > wheels.sha256
```

### Minimal Dependencies

The agent uses minimal dependencies:
- Flask: Web framework (well-maintained)
- prometheus_client: Metrics (official Prometheus client)
- psutil: System info (widely used)
- requests: HTTP client (industry standard)
- PyYAML: Config parsing (standard library alternative)

All are well-established, actively maintained packages.

## Performance

### Package Size
- Agent .deb: ~30-40 MB
- Installed size: ~50-60 MB
- Memory usage: ~50-100 MB (running)

### Installation Time
- Offline install: ~10-30 seconds
- No network delays
- No package downloads

### Startup Time
- Service start: ~2-5 seconds
- Registration: ~1-2 seconds
- Total: ~5-10 seconds

## Comparison: Online vs Offline

| Aspect | Online Install | Offline Install |
|--------|---------------|-----------------|
| Package size | ~5 MB | ~35 MB |
| Install time | 1-5 minutes | 10-30 seconds |
| Internet required | Yes | No |
| Reliability | Depends on network | Always works |
| Security | Downloads from PyPI | Pre-verified packages |
| Air-gap compatible | No | Yes |

## Summary

The PatchMaster agent is now fully self-contained:

✅ All Python dependencies bundled  
✅ No internet required on target hosts  
✅ Works in air-gapped environments  
✅ Single .deb package (~35 MB)  
✅ Fast installation (~30 seconds)  
✅ Reliable and reproducible  

Build once with internet, deploy anywhere without internet.
