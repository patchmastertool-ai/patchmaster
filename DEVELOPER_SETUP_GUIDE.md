# PatchMaster Developer Setup Guide

## Essential Files to Transfer

### Minimum Required Files (Core Source Code)
```
patchmaster/
├── agent/                          # Agent source code
│   ├── agent.py                   # Main agent application
│   ├── main.py                    # Agent heartbeat service
│   ├── uninstall_agent.py         # Cross-platform uninstaller
│   ├── build_agent_artifacts.py   # Build script for agent
│   ├── requirements.txt           # Python dependencies
│   ├── windows_installer.py       # Windows installer builder
│   ├── windows_installer_payload/ # Windows installation files
│   ├── windows_service/           # Windows service wrapper
│   ├── build-deb.sh              # Debian package builder
│   ├── build-rpm.sh              # RPM package builder
│   └── *.spec files              # PyInstaller specs
│
├── backend/                       # Backend API server
│   ├── api/                      # All API endpoints
│   ├── models/                   # Database models
│   ├── migrations/               # Database migrations
│   ├── static/                   # Static files (installers, monitoring)
│   ├── tests/                    # Test suite
│   ├── main.py                   # FastAPI application
│   ├── auth.py                   # Authentication
│   ├── license.py                # License validation
│   ├── database.py               # Database connection
│   ├── requirements.txt          # Python dependencies
│   └── Dockerfile.prod           # Production Docker image
│
├── frontend/                      # React frontend
│   ├── src/                      # React components
│   ├── public/                   # Static assets
│   ├── package.json              # Node dependencies
│   ├── vite.config.js            # Vite configuration
│   └── Dockerfile.prod           # Production Docker image
│
├── vendor/                        # License vendor portal
│   ├── app.py                    # Flask application
│   ├── templates/                # HTML templates
│   ├── requirements.txt          # Python dependencies
│   └── wheels/                   # Python wheel packages
│
├── scripts/                       # Build and deployment scripts
│   ├── build_release.py          # Release builder
│   ├── run_tests.py              # Test runner
│   ├── install_patchmaster_server.sh
│   ├── install_patchmaster_docker.sh
│   └── uninstall_patchmaster.sh
│
├── packaging/                     # Installation packages
├── monitoring/                    # Monitoring configs (Grafana, Prometheus)
├── docs/                         # Documentation
├── docker-compose.yml            # Docker Compose for development
├── docker-compose.prod.yml       # Docker Compose for production
├── Makefile                      # Build automation
├── README.md                     # Project overview
└── .gitignore                    # Git ignore rules
```

## What NOT to Transfer (Can be Regenerated)

- `node_modules/` - Reinstall with `npm install`
- `.venv/`, `.venv-vendor/`, `.build-release-venv/` - Python virtual environments
- `__pycache__/`, `*.pyc` - Python bytecode cache
- `.git/` - Git history (optional, can clone from remote)
- `dist/`, `agent/dist/` - Build outputs
- `reports/` - Test reports
- `*.tar.gz`, `*.zip` - Archive files
- `.pytest_cache/` - Pytest cache

## Setup Instructions for Developers

### Prerequisites

1. **Python 3.10+** (3.12 or 3.13 recommended)
2. **Node.js 18+** and npm
3. **Docker** and Docker Compose (for containerized deployment)
4. **Git** (optional, for version control)
5. **PostgreSQL** (for database)

### Step 1: Extract the Archive

```bash
# Extract the backup
tar -xzf patchmaster-full-backup-20260405-122632.tar.gz
cd patchmaster
```

### Step 2: Backend Setup

```bash
cd backend

# Create Python virtual environment
python -m venv .venv

# Activate virtual environment
# On Linux/Mac:
source .venv/bin/activate
# On Windows:
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration:
# - DATABASE_URL
# - PM_SECRET_KEY
# - LICENSE_SIGN_KEY

# Run database migrations
# (Migrations are in backend/migrations/)
# Apply them manually or use your migration tool

# Run tests (optional)
cd ..
python scripts/run_tests.py

# Start backend server (development)
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Step 3: Frontend Setup

```bash
cd frontend

# Install Node dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with backend API URL

# Start development server
npm run dev

# Or build for production
npm run build
```

### Step 4: Agent Setup (Optional - for testing)

```bash
cd agent

# Create Python virtual environment
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Run agent locally (for testing)
python agent.py

# Build agent packages
python build_agent_artifacts.py
```

### Step 5: Vendor Portal Setup (Optional)

```bash
cd vendor

# Create Python virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env with database and license keys

# Run vendor portal
python app.py
```

## Docker Deployment (Recommended for Production)

### Development Environment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Environment

```bash
# Build and start production services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Quick Start with Make

```bash
# Install all dependencies
make install

# Run tests
make test

# Build release
make release

# Start development environment
make dev

# Build Docker images
make docker-build

# Deploy to production
make deploy
```

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/patchmaster
PM_SECRET_KEY=your-secret-key-here
LICENSE_SIGN_KEY=your-license-signing-key
REDIS_URL=redis://localhost:6379
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### Vendor (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/vendor
LICENSE_SIGN_KEY=your-license-signing-key
LICENSE_ENCRYPT_KEY=your-encryption-key
```

## Database Setup

### PostgreSQL

```bash
# Create databases
createdb patchmaster
createdb vendor

# Run migrations
cd backend
# Apply SQL files from backend/migrations/ in order
psql -d patchmaster -f migrations/20260311_add_backup_storage_columns.sql
psql -d patchmaster -f migrations/20260311_add_cve_metadata.sql
# ... apply all migration files in chronological order
```

## Building Release Packages

```bash
# Build complete release
python scripts/build_release.py

# Output will be in dist/:
# - patchmaster-product-2.0.0.tar.gz (complete product)
# - patchmaster-vendor-2.0.0.tar.gz (vendor portal)
# - developer/ (developer kit)
```

## Testing

```bash
# Run all tests
python scripts/run_tests.py

# Run specific test file
pytest backend/tests/test_master.py

# Run with coverage
pytest --cov=backend backend/tests/
```

## Troubleshooting

### Python Version Issues
- Use Python 3.10, 3.11, 3.12, or 3.13
- Avoid Python 3.9 or older

### Missing Dependencies
```bash
# Backend
pip install -r backend/requirements.txt

# Frontend
npm install

# Vendor
pip install -r vendor/requirements.txt
```

### Database Connection Issues
- Check DATABASE_URL in .env
- Ensure PostgreSQL is running
- Verify database exists

### Port Conflicts
- Backend: Default port 8000
- Frontend: Default port 5173 (Vite dev server)
- Vendor: Default port 5001

## Key Features Implemented

✅ Server-side patch upload with batch uploading  
✅ Dependency handling using apt-get (not dpkg)  
✅ Amazon Linux 2 and 2023 support  
✅ Cross-platform uninstaller (Windows EXE, Linux script)  
✅ Test permission error fixes  
✅ Build script improvements (Python 3.10+ support)  
✅ No upload size limits  
✅ JSON output display fixes in UI  

## Important Files Modified (Recent Changes)

- `agent/agent.py` - Upload limits removed, apt-get dependency handling, Amazon Linux support
- `agent/main.py` - Logging permission fixes
- `agent/uninstall_agent.py` - NEW: Cross-platform uninstaller
- `backend/api/agent_proxy.py` - Batch upload implementation
- `scripts/build_release.py` - Import fixes, Python version support
- `frontend/src/App.css` - JSON display fixes
- `docs/kiro-notes/` - All documentation of fixes

## Support

For issues or questions:
1. Check `docs/` directory for documentation
2. Review `docs/kiro-notes/` for recent fixes
3. Check GitHub issues (if repository is public)
4. Contact the development team

## License

Check LICENSE file for licensing information.
