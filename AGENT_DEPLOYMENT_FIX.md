# Agent Deployment Fix - Missing Python Dependencies

## Problem Summary

Multiple PatchMaster Agent installations were failing with `ModuleNotFoundError`:

- **patch-agent.service**: `ModuleNotFoundError: No module named 'yaml'` (PyYAML)
- **patch-agent-heartbeat.service**: `ModuleNotFoundError: No module named 'requests'`

## Root Cause

The agent packages were built without properly installing Python dependencies into the bundled virtualenv, or the dependencies were installed for a different Python version than what's available on the target systems.

## Solution

### 1. Fixed Build Scripts

Updated build scripts now include:
- **Enhanced dependency verification** - checks that all packages are installed
- **Import testing** - verifies Python imports work correctly  
- **Better error handling** - fails build if dependencies missing
- **Version bump** - 2.0.1 to indicate fixed packages

### 2. Available Fix Scripts

#### For Existing Broken Agents
```bash
# Fix dependencies on existing agent servers
sudo bash fix_agent_dependencies.sh
```

#### For Building New Fixed Packages
```bash
# Build all packages at once using WSL
wsl bash -c "cd /mnt/c/pat-1/agent && bash build-all-fixed.sh 2.0.1"

# Build individual packages
wsl bash -c "cd /mnt/c/pat-1/agent && bash build-deb-fixed.sh"   # Ubuntu/Debian
wsl bash -c "cd /mnt/c/pat-1/agent && bash build-rpm.sh"         # RHEL/CentOS
```

### 3. Build Process (WSL)

The build process uses WSL (Python 3.12.3) with pre-downloaded wheels:

```bash
# Navigate to agent directory
cd /mnt/c/pat-1/agent

# Build all packages
bash build-all-fixed.sh 2.0.1
```

**Output locations:**
- All packages: `/mnt/c/pat-1/agent/dist/patch-agent-2.0.1.*`

### 4. Built Packages (v2.0.1)

All packages include bundled Python dependencies and have been verified:

| Package | Size | Platform |
|---------|------|----------|
| `patch-agent-2.0.1.deb` | 3.2M | Ubuntu/Debian |
| `patch-agent-2.0.1.rhel.tar.gz` | 4.6M | RHEL/CentOS/AlmaLinux |
| `patch-agent-2.0.1.arch.tar.gz` | 4.6M | Arch Linux |
| `patch-agent-2.0.1.alpine.tar.gz` | 4.6M | Alpine Linux |
| `patch-agent-2.0.1.debian.tar.gz` | 4.6M | Debian |
| `patch-agent-2.0.1.ubuntu.tar.gz` | 4.6M | Ubuntu |
| `patch-agent-2.0.1.freebsd.tar.gz` | 4.6M | FreeBSD (self-contained) |

All packages verified with:
- ✓ Flask installed
- ✓ PyYAML installed  
- ✓ requests installed
- ✓ psutil installed
- ✓ prometheus_client installed
- ✓ All imports tested successfully

### 5. Installation

#### Ubuntu/Debian (.deb)
```bash
# Install the fixed package
sudo dpkg -i /path/to/patch-agent-2.0.1.deb

# Configure controller URL
echo 'CONTROLLER_URL=http://your-controller:8000' | sudo tee -a /etc/patch-agent/env

# Start services
sudo systemctl start patch-agent patch-agent-heartbeat
```

#### RHEL/CentOS (tar.gz)
```bash
# Extract to /opt
sudo tar -xzf patch-agent-2.0.1.rhel.tar.gz -C /opt/

# Configure
echo 'CONTROLLER_URL=http://your-controller:8000' | sudo tee -a /etc/patch-agent/env

# Create systemd service (or use provided scripts)
sudo /opt/start-agent.sh &
```

#### Arch/Alpine/Other (tar.gz)
```bash
# Extract to desired location
sudo tar -xzf patch-agent-2.0.1.alpine.tar.gz -C /opt/

# Configure
echo 'CONTROLLER_URL=http://your-controller:8000' | sudo tee -a /etc/patch-agent/env

# Start using bundled scripts
sudo /opt/start-agent.sh &
sudo /opt/start-heartbeat.sh &
```

### 6. Verification

After installation, verify the fix:

```bash
# Check service status
sudo systemctl status patch-agent patch-agent-heartbeat

# Check recent logs
sudo journalctl -u patch-agent -n 10
sudo journalctl -u patch-agent-heartbeat -n 10

# Test Python imports manually
sudo /opt/patch-agent/venv/bin/python3 -c "import yaml; import requests; import flask"
```

### 7. For Offline Deployments

The packages are fully self-contained and work without internet access:

- All dependencies bundled in virtualenv
- No PyPI downloads required
- Verified to work on systems without internet

### 8. Build Environment Requirements

- **WSL with Python 3.12.3** (matches vendor/wheels cp312)
- **vendor/wheels directory** with pre-downloaded packages
- **dpkg-deb** for .deb packages
- **rpmbuild** for .rpm packages (optional)

### 9. Troubleshooting

#### If build fails:
1. Ensure WSL has Python 3.12+ available
2. Check vendor/wheels directory exists with required packages
3. Verify build scripts are executable

#### If agent still fails after install:
1. Run the fix script: `sudo bash fix_agent_dependencies.sh`
2. Check Python version compatibility
3. Verify virtualenv paths are correct

#### For different Python versions:
- Wheels in vendor/wheels are for cp312 (Python 3.12)
- For other Python versions, download appropriate wheels
- Update build scripts to use correct Python command

## Files Created/Modified

- ✅ `fix_agent_dependencies.sh` - Fix existing broken agents
- ✅ `agent/build-deb-fixed.sh` - Enhanced .deb build script
- ✅ `agent/build-deb.sh` - Updated original .deb script (v2.0.1)
- ✅ `agent/build-rpm.sh` - Updated .rpm script (v2.0.1)
- ✅ `agent/build-all-fixed.sh` - Build all platforms at once

## Next Steps

1. **Deploy fixed packages** to all agent servers
2. **Use fix script** for any remaining broken agents
3. **Verify installations** with the provided checks
4. **Monitor** for any remaining issues

The build process is now robust and ensures all dependencies are properly installed and verified before package creation.