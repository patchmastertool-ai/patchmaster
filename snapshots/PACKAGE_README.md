# PatchMaster Complete Package

## What's Included

This package contains EVERYTHING needed to run PatchMaster:

✅ **All Source Code**
- Agent (Python)
- Backend API (FastAPI)
- Frontend UI (React)
- Vendor Portal (Flask)

✅ **All Dependencies (Offline Ready)**
- Python wheel files in `vendor/wheels/`
- Node modules (if included)
- No internet required for installation

✅ **Automated Setup Scripts**
- `auto-setup.sh` (Linux/Mac)
- `auto-setup.ps1` (Windows)
- Handles all configuration automatically

✅ **Documentation**
- Setup guides
- API documentation
- Troubleshooting guides

✅ **Recent Fixes**
- Server-side patch upload with batch uploading
- Dependency handling improvements
- Amazon Linux 2 & 2023 support
- Cross-platform uninstaller
- Test permission fixes
- No upload size limits

## Quick Start (3 Steps)

### Linux/Mac

```bash
# 1. Extract
tar -xzf patchmaster-complete-*.tar.gz
cd patchmaster

# 2. Run automated setup
bash auto-setup.sh

# 3. Start services
./start-all.sh
```

### Windows

```powershell
# 1. Extract
tar -xzf patchmaster-complete-*.tar.gz
cd patchmaster

# 2. Run automated setup
powershell -ExecutionPolicy Bypass -File auto-setup.ps1

# 3. Start services
start-backend.cmd    # In one terminal
start-frontend.cmd   # In another terminal
```

## What the Auto-Setup Does

The `auto-setup` script automatically:

1. ✅ Checks Python version (3.10+)
2. ✅ Checks Node.js version (18+)
3. ✅ Creates Python virtual environments
4. ✅ Installs all Python dependencies (from local wheels if available)
5. ✅ Installs all Node.js dependencies
6. ✅ Creates configuration files (.env)
7. ✅ Generates random secret keys
8. ✅ Creates startup scripts
9. ✅ Handles all common errors automatically
10. ✅ Provides detailed logs

## Manual Setup (If Needed)

If you prefer manual setup or the auto-setup fails:

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install --no-index --find-links=../vendor/wheels -r requirements.txt
cp .env.example .env
# Edit .env with your settings
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your settings
npm run dev
```

## Configuration Files

After setup, review and update these files:

### backend/.env
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/patchmaster
PM_SECRET_KEY=your-secret-key
LICENSE_SIGN_KEY=your-license-key
```

### frontend/.env
```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### vendor/.env
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/vendor
LICENSE_SIGN_KEY=your-license-key
LICENSE_ENCRYPT_KEY=your-encrypt-key
```

## Prerequisites

### Required
- **Python 3.10+** (3.12 or 3.13 recommended)
- **Node.js 18+**
- **PostgreSQL 13+**

### Optional
- **Docker** (for containerized deployment)
- **Redis** (for caching)

## Installation Methods

### Method 1: Automated Setup (Recommended)
```bash
bash auto-setup.sh
```

### Method 2: Docker
```bash
docker-compose up -d
```

### Method 3: Manual Setup
Follow DEVELOPER_SETUP_GUIDE.md

## Accessing the Application

After setup:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Vendor Portal**: http://localhost:5001

## Offline/Air-Gapped Installation

This package is designed for offline installation:

1. All Python dependencies are in `vendor/wheels/`
2. The auto-setup script uses local wheels first
3. No internet connection required

To install offline:
```bash
# Backend
pip install --no-index --find-links=vendor/wheels -r backend/requirements.txt

# Frontend (if node_modules included)
# No additional steps needed
```

## Troubleshooting

### Python Version Issues
```bash
# Check version
python --version

# Use specific version
python3.12 -m venv .venv
```

### Node.js Not Found
```bash
# Install Node.js
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# RHEL/CentOS
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

### PostgreSQL Not Found
```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# RHEL/CentOS
sudo yum install postgresql-server postgresql-contrib

# macOS
brew install postgresql
```

### Permission Errors
```bash
# Make scripts executable
chmod +x auto-setup.sh
chmod +x start-*.sh

# Or run with bash
bash auto-setup.sh
```

### Port Already in Use
```bash
# Check what's using the port
lsof -i :8000  # Linux/Mac
netstat -ano | findstr :8000  # Windows

# Change port in configuration
# Backend: uvicorn main:app --port 8001
# Frontend: vite.config.js
```

## Building from Source

### Build Agent Packages
```bash
cd agent
python build_agent_artifacts.py

# Output:
# - agent-latest.deb
# - agent-latest.rpm
# - agent-windows.zip
```

### Build Release Package
```bash
python scripts/build_release.py

# Output in dist/:
# - patchmaster-product-2.0.0.tar.gz
```

## Testing

```bash
# Run all tests
python scripts/run_tests.py

# Run specific test
pytest backend/tests/test_master.py -v

# Run with coverage
pytest --cov=backend backend/tests/
```

## Production Deployment

### Using Docker (Recommended)
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Using Installation Script
```bash
sudo bash scripts/install_patchmaster_server.sh
```

### Manual Production Setup
1. Set up PostgreSQL database
2. Configure environment variables
3. Build frontend: `npm run build`
4. Use production WSGI server (gunicorn/uvicorn)
5. Set up reverse proxy (nginx)
6. Configure SSL certificates

## File Structure

```
patchmaster/
├── agent/                  # Patch agent
│   ├── agent.py           # Main agent
│   ├── uninstall_agent.py # Uninstaller
│   └── requirements.txt   # Dependencies
├── backend/               # API server
│   ├── api/              # API endpoints
│   ├── models/           # Database models
│   ├── migrations/       # DB migrations
│   └── requirements.txt  # Dependencies
├── frontend/             # React UI
│   ├── src/             # Source code
│   └── package.json     # Dependencies
├── vendor/              # License portal
│   ├── wheels/         # Python packages
│   └── requirements.txt
├── scripts/             # Build scripts
├── docs/               # Documentation
├── auto-setup.sh       # Automated setup (Linux/Mac)
├── auto-setup.ps1      # Automated setup (Windows)
└── docker-compose.yml  # Docker configuration
```

## Support

- **Documentation**: See `docs/` directory
- **Recent Changes**: See `docs/kiro-notes/`
- **Setup Guide**: See `DEVELOPER_SETUP_GUIDE.md`
- **Quick Start**: See `QUICK_START.md`

## License

See LICENSE file for details.

## Version

PatchMaster v2.0.0

## Package Information

- **Created**: Check filename timestamp
- **Size**: ~150-300 MB (depending on included dependencies)
- **Python Wheels**: Included in `vendor/wheels/`
- **Offline Ready**: Yes
- **Platform**: Cross-platform (Linux, Windows, macOS)

---

**Need Help?** Run `bash auto-setup.sh` and it will handle everything automatically!
