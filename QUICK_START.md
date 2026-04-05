# PatchMaster Quick Start Guide

## For Developers Receiving the Package

### What You'll Receive

One of these files:
- `patchmaster-full-backup-YYYYMMDD-HHMMSS.tar.gz` (148 MB - includes everything)
- `patchmaster-minimal-YYYYMMDD-HHMMSS.tar.gz` (smaller - source code only)

### Quick Setup (5 Minutes)

#### 1. Extract
```bash
tar -xzf patchmaster-*.tar.gz
cd patchmaster
```

#### 2. Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

#### 3. Frontend Setup
```bash
cd frontend
npm install
```

#### 4. Run (Development)
```bash
# Terminal 1 - Backend
cd backend
source .venv/bin/activate
uvicorn main:app --reload

# Terminal 2 - Frontend
cd frontend
npm run dev
```

#### 5. Access
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Docker Quick Start (Even Faster)

```bash
# Extract package
tar -xzf patchmaster-*.tar.gz
cd patchmaster

# Start everything
docker-compose up -d

# Access at http://localhost
```

## Essential Files Structure

```
patchmaster/
├── agent/              # Patch agent (runs on target servers)
├── backend/            # API server (FastAPI + PostgreSQL)
├── frontend/           # Web UI (React + Vite)
├── vendor/             # License vendor portal
├── scripts/            # Build and deployment scripts
├── docs/               # Documentation
└── docker-compose.yml  # Docker setup
```

## Key Commands

### Development
```bash
make install    # Install all dependencies
make dev        # Start development servers
make test       # Run tests
```

### Building
```bash
make build      # Build all components
make release    # Create release package
```

### Docker
```bash
docker-compose up -d              # Start all services
docker-compose logs -f            # View logs
docker-compose down               # Stop services
```

## Environment Setup

### Required Software
- Python 3.10+ (3.12 recommended)
- Node.js 18+
- PostgreSQL 13+
- Docker (optional but recommended)

### Environment Variables

Create `.env` files:

**backend/.env**
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/patchmaster
PM_SECRET_KEY=generate-random-key-here
LICENSE_SIGN_KEY=generate-random-key-here
```

**frontend/.env**
```env
VITE_API_URL=http://localhost:8000
```

## Recent Fixes Included

✅ Server-side patch upload with batch uploading  
✅ Dependency handling (apt-get instead of dpkg)  
✅ Amazon Linux 2 & 2023 support  
✅ Cross-platform uninstaller  
✅ Test permission fixes  
✅ No upload size limits  
✅ JSON display fixes in UI  

## Need Help?

1. Read `DEVELOPER_SETUP_GUIDE.md` for detailed instructions
2. Check `docs/kiro-notes/` for recent changes and fixes
3. Review `docs/public/INSTALL.md` for installation guide
4. Check `README.md` for project overview

## Common Issues

### "Module not found" errors
```bash
# Backend
pip install -r backend/requirements.txt

# Frontend
npm install
```

### Database connection errors
```bash
# Create database
createdb patchmaster

# Check DATABASE_URL in backend/.env
```

### Port already in use
```bash
# Change ports in:
# - backend: uvicorn main:app --port 8001
# - frontend: vite.config.js (server.port)
```

## Production Deployment

```bash
# Use production Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Or use installation script
sudo bash scripts/install_patchmaster_server.sh
```

## Testing

```bash
# Run all tests
python scripts/run_tests.py

# Run specific tests
pytest backend/tests/test_master.py -v
```

## Building Agent Packages

```bash
cd agent
python build_agent_artifacts.py

# Output:
# - agent-latest.deb (Debian/Ubuntu)
# - agent-latest.rpm (RHEL/CentOS/Amazon Linux)
# - agent-windows.zip (Windows)
```

## File Sizes

- Full backup: ~148 MB (includes build outputs)
- Minimal package: ~30-50 MB (source code only)
- After npm install: +200 MB (node_modules)
- After pip install: +100 MB (Python packages)

## What's Excluded from Minimal Package

These can be regenerated:
- `node_modules/` - Run `npm install`
- `.venv/` - Run `python -m venv .venv`
- `__pycache__/` - Auto-generated
- `dist/` - Run build scripts
- Binary files (.exe, .deb, .rpm) - Run build scripts

## Next Steps

1. ✅ Extract package
2. ✅ Install dependencies
3. ✅ Configure environment variables
4. ✅ Start development servers
5. 📖 Read full documentation
6. 🔨 Start developing!

---

**Questions?** Check `DEVELOPER_SETUP_GUIDE.md` for comprehensive instructions.
