# PatchMaster by YVGROUP

**PatchMaster** is an enterprise-grade patch management platform designed for mixed Linux and Windows environments. It provides a centralized dashboard for managing security updates, software deployment, compliance, and automated workflows across hybrid and air-gapped infrastructures.

---

## 🚀 Key Features

- **Multi-OS Support**: Native agents for Debian/Ubuntu (.deb), RedHat/CentOS/Rocky (.rpm), and Windows.
- **Air-Gapped Readiness**: Local package repository on the Master node for pushing updates to isolated servers.
- **Snapshot & Rollback**: Automatic pre-patch snapshots and one-click rollbacks.
- **Software Manager**: Bulk install/remove arbitrary software packages across your fleet.
- **Zero-Touch Monitoring**: Pre-configured Prometheus and Grafana dashboards for real-time visibility.
- **Tiered Licensing**: Flexible feature sets (Basic, Standard, DevOps, Enterprise) managed via a secure Vendor Portal.
- **Security First**: Role-Based Access Control (RBAC), Audit Trails, and CVE Tracking.

---

## 🏗️ Architecture

- **Master Node (Backend)**: FastAPI-powered central controller managing hosts, jobs, and licenses.
- **Dashboard (Frontend)**: Modern React-based UI for seamless administration.
- **Universal Agent**: Lightweight Python agent running on target servers.
- **Vendor Portal**: Standalone tool for license generation and customer management (distributed separately).

---

## 🛠️ Installation

### 1. Master Node Deployment

We provide a comprehensive installer that handles all dependencies (PostgreSQL, Nginx, Systemd services).

```bash
# Clone the repository (or extract the release tarball)
git clone <your-repository-url>
cd patchmaster

# Run the Enterprise Installer
sudo ./packaging/install-bare.sh
```

**Installer Capabilities:**
- Detects OS (Debian/RHEL family)
- Installs Python 3.8+, PostgreSQL, Nginx, Node.js (if needed)
- Sets up system users and permissions
- Configures Systemd services for Backend and Monitoring
- Generates SSL certificates (optional)
- Deploys Grafana & Prometheus (optional flag: `--with-monitoring`)

### 2. Agent Deployment

Agents can be installed directly from the Master node UI or via CLI:

**Linux:**
```bash
curl -fsSL http://<master-ip>:3000/download/install.sh | sudo bash -s -- <master-ip>
```

**Windows (Command Prompt / Admin):**
```bat
curl.exe -L -o PatchMaster-Agent-Installer.exe http://<master-ip>:3000/download/patchmaster-agent-installer.exe
.\PatchMaster-Agent-Installer.exe --master-url http://<master-ip>:8000
```

**Windows (CMD helper):**
```bat
curl.exe -L -o install-agent.cmd http://<master-ip>:3000/download/install-agent.cmd
install-agent.cmd
```

---

## 📦 Building Releases

To create distributable packages for customers and the vendor portal:

```bash
./scripts/build-release.sh
```

**Artifacts:**
- `dist/patchmaster-product-2.0.0.tar.gz`: The core product for customers.
- `vendor/dist/patchmaster-vendor-2.0.0.tar.gz`: The internal vendor portal.

### Offline / WSL build notes
Run builds from WSL Ubuntu with offline-friendly defaults (no PyPI/DNS):

```bash
cd /mnt/c/Users/Admin/Desktop/pat
PIP_OPTS="--no-index" OFFLINE=1 PIP_DISABLE_PIP_VERSION_CHECK=1 bash scripts/build-stable.sh
OFFLINE=1 PIP_OPTS="--no-index" PIP_DISABLE_PIP_VERSION_CHECK=1 python3 agent/build_agent_artifacts.py
cd frontend && npm install && VITE_API_URL=http://172.19.189.182:8000 npm run build
```

Ensure offline wheel cache: place required wheels (Flask, prometheus_client, psutil, requests, pydantic, PyYAML, PyInstaller, setuptools, wheel, and their deps) under `vendor/wheels/`. Build scripts auto-use that path as `PIP_FIND_LINKS`; override if you store wheels elsewhere. For Windows, this covers building the offline `patchmaster-agent-installer.exe` (no PowerShell needed on target).

---

## 🛡️ Security & Compliance

- **VAPT Ready**: Implements secure headers (CSP, HSTS, XFO) and encrypted JWT sessions.
- **Audit Logs**: Detailed tracking of every action taken by users.
- **CVE Tracking**: Built-in vulnerability scanner with CSV export for compliance reporting.

---

## 📄 Documentation

We have prepared detailed Standard Operating Procedures (SOPs) for all roles:

- **[End User Guide](docs/SOP_End_User.md)**: For System Admins managing patches.
- **[Feature Matrix](docs/Feature_Matrix.md)**: Comparison of license tiers (Basic, Standard, Enterprise).
- **[HA/DR Deployment](docs/SOP_HA_DR_Deployment.md)**: Enterprise Active-Active & Active-Passive Architecture.
- **[Vendor Portal Guide](docs/SOP_Vendor_User.md)**: For sales and account managers generating licenses.
- **[Developer Guide](docs/SOP_Vendor_Developer.md)**: For engineers building PatchMaster.
- **[Support Guide](docs/SOP_Technical_Support.md)**: For L1-L3 technical support teams.

---

## 📄 License

Managed by **YVGROUP**. Contact your vendor for license keys and support.

© 2026 YVGROUP. All rights reserved.
