# Customer Product Package Contents - v2.0.1

## Package Information

- **File:** `dist/patchmaster-2.0.1.tar.gz`
- **Size:** 72 MB
- **Checksum:** `dist/patchmaster-2.0.1.tar.gz.sha256`
- **Build Date:** April 17, 2026

## Package Contents

### ✅ Included Components

#### 1. Agent Source Code
- **Location:** `./agent/`
- **Files:**
  - `agent/agent.py` - Main agent application
  - `agent/main.py` - Heartbeat service
  - `agent/requirements.txt` - Python dependencies
  - `agent/build-all-fixed.sh` - Build script for all agent packages
  - `agent/build-deb-fixed.sh` - Build script for Ubuntu/Debian
  - `agent/build-rpm.sh` - Build script for RHEL/CentOS
  - Platform-specific scripts (AIX, HP-UX, Solaris, FreeBSD, Alpine, Arch)

#### 2. Backend API
- **Location:** `./backend/`
- Flask-based REST API
- Database models and migrations
- Authentication and authorization
- Agent management endpoints

#### 3. Frontend Application
- **Location:** `./frontend/`
- Pre-built React application (`frontend/dist/`)
- Source code included
- Vite build configuration

#### 4. Vendor Wheels (Offline Installation)
- **Location:** `./vendor/vendor/wheels/`
- All Python dependencies for agent installation:
  - Flask-3.1.3
  - PyYAML-6.0.3
  - requests-2.33.1
  - psutil-7.2.2
  - prometheus_client-0.25.0
  - blinker-1.9.0
  - click-8.3.2
  - itsdangerous-2.2.0
  - jinja2-3.1.6
  - markupsafe-3.0.3
  - werkzeug-3.1.8
  - charset_normalizer-3.4.7
  - idna-3.11
  - urllib3-2.6.3
  - certifi-2026.2.25

#### 5. Deployment Files
- `docker-compose.yml` - Docker Compose configuration
- `docker-compose.prod.yml` - Production configuration
- `docker-compose.ha.yml` - High availability configuration
- `Makefile` - Build and deployment commands
- `auto-setup.sh` / `auto-setup.ps1` - Automated setup scripts

#### 6. Documentation
- `README.md` - Project documentation
- `docs/public/` - Public documentation files

#### 7. Monitoring
- Prometheus configuration
- Grafana dashboards

## What's NOT Included

### ❌ Pre-built Agent Packages

The following pre-built agent packages are **NOT** included in this tarball:
- `patch-agent-2.0.1.deb` (Ubuntu/Debian)
- `patch-agent-2.0.1.rhel.tar.gz` (RHEL/CentOS)
- `patch-agent-2.0.1.arch.tar.gz` (Arch Linux)
- `patch-agent-2.0.1.alpine.tar.gz` (Alpine Linux)
- `patch-agent-2.0.1.debian.tar.gz` (Debian)
- `patch-agent-2.0.1.ubuntu.tar.gz` (Ubuntu)
- `patch-agent-2.0.1.freebsd.tar.gz` (FreeBSD)

**These must be built separately using the included build scripts.**

## Installation Instructions

### Option 1: Full System Deployment

```bash
# Extract the package
tar -xzf patchmaster-2.0.1.tar.gz

# Run automated setup
bash auto-setup.sh

# Or use Docker Compose
docker-compose up -d
```

### Option 2: Agent Deployment

Customers need to build agent packages from the source code:

```bash
# Navigate to agent directory
cd agent

# Build all agent packages
bash build-all-fixed.sh 2.0.1

# Or build specific packages:
bash build-deb-fixed.sh      # Ubuntu/Debian
bash build-rpm.sh            # RHEL/CentOS
bash build-arch.sh           # Arch Linux
bash build-apk-simple.sh     # Alpine Linux
bash build-freebsd-simple.sh # FreeBSD
```

### Option 3: Use Pre-built Agent Packages

If you have the pre-built agent packages (from a separate distribution):

```bash
# Ubuntu/Debian
sudo dpk -i patch-agent-2.0.1.deb

# RHEL/CentOS/Other
sudo tar -xzf patch-agent-2.0.1.rhel.tar.gz -C /opt/
```

## Verification

After installation, verify the system is working:

```bash
# Check backend API
curl http://localhost:5000/api/health

# Check frontend
curl http://localhost:3000

# Check agent (if installed)
sudo systemctl status patch-agent
```

## Important Notes

1. **Agent Packages:** The customer product package contains agent source code but NOT pre-built agent packages. Customers must either:
   - Build agents from source using the included scripts
   - Obtain pre-built agent packages separately

2. **Offline Installation:** The package includes vendor wheels for offline installation of Python dependencies.

3. **Build Environment:** To build agent packages, customers need:
   - Python 3.12+ (for building)
   - Bash shell
   - tar and gzip utilities
   - For .deb packages: dpkg-deb
   - For .rpm packages: rpmbuild (optional)

4. **Documentation:** Full documentation is included in the `docs/` directory.

## Support

For issues or questions:
1. Check the `README.md` file
2. Review documentation in `docs/`
3. Check build scripts in `agent/` for usage instructions

---

**Package Status:** ✅ Complete and Ready for Deployment  
**Agent Status:** ⚠️ Source code included, pre-built packages distributed separately