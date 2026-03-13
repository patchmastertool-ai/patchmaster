# PatchMaster by YVGROUP v2.0.0

Enterprise Linux Patch Management Platform with tiered licensing, monitoring integration, and vendor management tools.

---

## Project Structure

This project is split into two independently deployable parts:

```
┌─────────────────────────────────────────────────────────────┐
│             PatchMaster by YVGROUP Repository               │
├─────────────────────────────┬───────────────────────────────┤
│     PRODUCT (User End)      │     VENDOR (Our End)          │
│  Ships to customers         │  Internal business tools      │
├─────────────────────────────┼───────────────────────────────┤
│  agent/        .deb agent   │  vendor/app.py     Portal     │
│  backend/      FastAPI      │  vendor/generate-  License    │
│  frontend/     React UI     │    license.py      Generator  │
│  monitoring/   Prometheus   │  vendor/templates/ Web UI     │
│  packaging/    Install/     │  vendor/scripts/   Backups    │
│                Build tools  │  vendor/Makefile   Commands   │
│  docker-compose.prod.yml    │  vendor/docker-    Docker     │
│  Makefile                   │    compose.yml     Stack      │
│  .env.production            │  vendor/.env.      Config     │
│                             │    example                    │
├─────────────────────────────┼───────────────────────────────┤
│  Deploy to: Customer server │  Deploy to: Internal server   │
│  Port: 3000 (UI), 8000 API │  Port: 8080 (Portal)          │
│  Stack: Docker / Bare-metal │  Stack: Docker (Gunicorn+Nginx│
└─────────────────────────────┴───────────────────────────────┘
```

---

## Product (User End)

The PatchMaster by YVGROUP platform that customers install on their Linux servers.

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Backend | FastAPI + PostgreSQL | REST API, patch jobs, license validation |
| Frontend | React + Nginx | Web dashboard for patch management |
| Agent | Python .deb package | Runs on managed hosts, executes patches |
| Monitoring | Prometheus + Grafana | Metrics collection & dashboards |

### Quick Deploy

```bash
# Docker (recommended)
cp .env.production .env
nano .env                       # Set passwords & secrets
make prod                       # Start without monitoring
make prod-monitoring            # Start with monitoring

# Bare-metal
sudo ./packaging/install-bare.sh --env .env
```

### Build Release Package

```bash
./scripts/build-release.sh
# Output: dist/patchmaster-product-2.0.0.tar.gz
```

### License Tiers

| Tier | Features | Description |
|------|----------|-------------|
| Basic (10) | Patching, hosts, groups, schedules | Core patch management |
| Standard (16) | + Compliance, CVE, audit, monitoring | Security & compliance |
| DevOps (18) | + CI/CD, Git integration | Pipeline automation |
| Enterprise (20) | All features | Full platform access |

---

## Vendor Portal (Our End)

Internal tool for managing customers, purchases, and licenses.

```bash
cd vendor/
make setup                      # Create .env
nano .env                       # Set admin password & secret key
make prod                       # Start Docker stack → http://localhost:8080
```

### Features
- Customer CRUD with search & filtering
- Purchase tracking with auto license generation
- License lifecycle (view, revoke, regenerate)
- Revenue reports & analytics
- CLI license generator (`generate-license.py`)
- Activity audit log

See [vendor/README.md](vendor/README.md) for full documentation.

---

## Release Build

The `scripts/build-release.sh` script creates two separate packages:

```bash
./scripts/build-release.sh

# Creates:
#   dist/patchmaster-product-2.0.0.tar.gz    → Give to customers
#   dist/patchmaster-vendor-2.0.0.tar.gz     → Deploy internally
```

Each package is self-contained with its own Docker Compose, Makefile, and configuration.

---

## Development

```bash
# Start product in dev mode
docker compose up -d --build

# Start vendor portal in dev mode
cd vendor/ && make dev
```

## Architecture

```
Customer Server                          Vendor Server (Internal)
┌──────────────────────────┐             ┌──────────────────────┐
│  Frontend (React :3000)  │             │  Vendor Portal :8080 │
│  ┌────────────────────┐  │             │  ┌────────────────┐  │
│  │ Nginx → React SPA  │  │             │  │ Nginx → Gunicorn│  │
│  └────────┬───────────┘  │             │  │ → Flask App    │  │
│           │ /api/*       │             │  └───────┬────────┘  │
│  ┌────────▼───────────┐  │             │          │           │
│  │ Backend (FastAPI)   │  │   License  │  ┌───────▼────────┐  │
│  │ :8000               │◄─── Keys ────│  │ SQLite DB      │  │
│  └────────┬───────────┘  │             │  │ (customers.db) │  │
│           │              │             │  └────────────────┘  │
│  ┌────────▼───────────┐  │             │                      │
│  │ PostgreSQL          │  │             │  generate-license.py │
│  └────────────────────┘  │             │  (CLI tool)          │
│                          │             └──────────────────────┘
│  Prometheus :9090        │
│  Grafana    :3001        │
│                          │
│  Agent (on managed hosts)│
└──────────────────────────┘
```

---

## SSL / HTTPS

Both the Product and Vendor portal support HTTPS when SSL certificates are provided. Nginx auto-detects certificates and redirects HTTP → HTTPS.

### Certificate Setup (Docker)

```bash
# 1. Place certificates (Let's Encrypt, commercial CA, or self-signed)
mkdir -p certs/
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem certs/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem   certs/
chmod 600 certs/privkey.pem

# 2. Start — Nginx auto-detects certs and enables HTTPS
make prod

# 3. Verify
make ssl-check
```

Default ports: **Product** HTTP :3000 → HTTPS :443, **Vendor** HTTP :8080 → HTTPS :8443.

Override in `.env`:
```
SSL_CERT_DIR=./certs
FRONTEND_SSL_PORT=443
VENDOR_SSL_PORT=8443
```

### Certificate Setup (Bare-Metal)

```bash
sudo ./packaging/install-bare.sh \
    --ssl-cert /etc/letsencrypt/live/yourdomain.com/fullchain.pem \
    --ssl-key  /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

To add SSL after initial install, re-run the installer with the `--ssl-cert` and `--ssl-key` flags.

### Self-Signed Certificate (Testing Only)

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout certs/privkey.pem -out certs/fullchain.pem \
    -subj "/CN=patchmaster.local"
```

### Certificate Renewal

**Docker**: Replace files in `certs/` and restart: `docker compose -f docker-compose.prod.yml restart frontend`

**Bare-metal**: Replace files in `/opt/patchmaster/certs/` and restart: `systemctl restart nginx`
