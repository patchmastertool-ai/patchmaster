<div align="center">
  <h1>🛡️ PatchMaster Enterprise</h1>
  <p><b>Next-Generation, High-Availability Patch Management & Deployment Platform</b></p>

  [![Version](https://img.shields.io/badge/version-2.0.17-blue.svg?style=for-the-badge)](https://github.com/your-org/patchmaster)
  [![Status](https://img.shields.io/badge/status-Production_Ready-success.svg?style=for-the-badge)]()
  [![License](https://img.shields.io/badge/license-Proprietary-red.svg?style=for-the-badge)]()
  [![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20UNIX%20%7C%20Windows-lightgrey?style=for-the-badge)]()
</div>

<br/>

## 📖 About The Project

PatchMaster Enterprise is a comprehensive, highly-scalable systems administration and patch management platform built for modern, mission-critical infrastructure. 

Managing large fleets of heterogeneous servers often involves dealing with fragmentation, security vulnerabilities, and complex networking restrictions. PatchMaster solves these issues by providing a **unified command center** that enables IT administrators to securely deploy updates, monitor system health in real-time, and enforce compliance policies across their entire infrastructure—regardless of the underlying operating system. 

Whether your servers are hosted in the cloud or isolated in highly secure on-premise data centers, PatchMaster provides the visibility and control needed to reduce downtime and prevent security breaches.

---

## ✨ Key Features

### 🚀 Enterprise-Grade Deployment
- **Canary Testing & Phased Rollouts:** Test patches on a subset of hosts before automatically triggering a full rollout upon success, minimizing the risk of system-wide failures.
- **High Availability:** Production-ready Docker Compose configurations designed for resilience, load-balancing, and fast recovery.

### 🔌 Intelligent Agent Management
- **Cross-Platform Support:** Seamlessly manage diverse endpoints including Linux (Ubuntu, Debian, RHEL, Alpine, Arch), AIX, Solaris, HP-UX, and Windows nodes from a single dashboard.
- **Real-Time Visibility:** WebSocket-driven architecture for live system metrics, dynamic group tagging, and instant notifications.
- **Automated Remediation:** Built-in bash scripts autonomously detect and fix agent registration, visibility, and connectivity anomalies.

### 🛡️ Hardened Security
- **Secure Authentication:** Cryptographically secure password generation, advanced weak-password detection, and robust token lifecycle management.
- **Built-in Vulnerability Checks:** Granular Role-Based Access Control (RBAC), CVE security checks before deployment, and strict API rate-limiting policies.
- **Encrypted Communication:** Nginx proxy configuration enforcing secure connections and WebSocket proxying.

### 🎨 Command Horizon UI & Stitch Builder
- **Modern Interface:** Built with React and Vite using the custom *Command Horizon* design system for high-density, professional UI.
- **Stitch UI Builder (Beta):** An integrated AI-powered interface builder for generating modern React pages with dynamic code previews and real-time syntax validation.

---

## 🔒 Vendor Strategy & Air-Gapped Support

One of PatchMaster's most critical features is its ability to operate entirely offline. Many enterprise environments restrict server internet access for security reasons (air-gapped networks). 

The `./vendor/` directory contains our **Vendor Strategy** implementation:
- **Offline Wheels:** All dependencies (like Flask, PyYAML, psutil, prometheus_client, etc.) are pre-downloaded as Python wheels and securely bundled into the `/vendor/vendor/wheels/` directory.
- **Zero Internet Required:** When installing the PatchMaster backend or deploying agents to target nodes, the system installs strictly from these local vendor wheels. It never attempts to reach out to PyPI or external package repositories.
- **Self-Contained Agents:** This strategy allows us to produce fully self-contained agent packages (~35MB) that can be transported via secure media and deployed on highly classified or disconnected networks seamlessly.

---

## 🏗️ System Architecture

PatchMaster follows a decoupled, service-oriented architecture:

1. **Frontend (`/frontend`):** A responsive Single Page Application built with React and Vite.
2. **Backend (`/backend`):** A high-performance Python REST API managing data, tasks, and state.
3. **Database:** PostgreSQL used as the primary persistent data store, fortified with row-level locking to prevent deadlocks.
4. **Proxy:** Nginx handling routing, reverse proxying for the API, and upgrading WebSocket connections.
5. **Agents (`/agent`):** Lightweight, independent Python daemons running on target hosts to execute commands and report heartbeat telemetry.

---

## 📦 Project Structure

```text
patchmaster-enterprise/
├── agent/                  # Cross-platform agent source code & build scripts
├── backend/                # Python REST API, database models, auth handlers
├── frontend/               # React SPA & Command Horizon UI components
├── vendor/                 # Offline dependencies (wheels) for air-gapped installs
├── scripts/                # Automated repair and diagnostic tools
├── docs/                   # Internal project documentation and release notes
├── docker-compose.yml      # Standard local deployment
├── docker-compose.prod.yml # Production-optimized Docker setup
├── docker-compose.ha.yml   # High Availability setup
└── README.md               # You are here
```

---

## ⚙️ Installation & Deployment

### Option A: Docker (Recommended for Production)
The fastest way to deploy PatchMaster Enterprise is via Docker Compose.

```bash
# 1. Clone the repository
git clone https://github.com/your-org/patchmaster.git
cd patchmaster

# 2. Launch the Production Stack
docker-compose -f docker-compose.prod.yml up -d

# 3. Verify services
docker-compose -f docker-compose.prod.yml ps
```

### Option B: Bare-Metal Installation
For dedicated servers without containerization:

```bash
# Extract the release package
tar -xzf patchmaster-2.0.1.tar.gz
cd patchmaster-2.0.1

# Run the automated setup script
sudo bash auto-setup.sh
```

### Option C: Agent Deployment
Agents must be compiled for their target platforms using the provided scripts:
```bash
cd agent
# Build for all platforms
bash build-all-fixed.sh 2.0.1 

# Or build for specific targets
bash build-deb-fixed.sh  # Ubuntu/Debian
bash build-rpm.sh        # RHEL/CentOS
```

---

## 🛠️ Diagnostics & Troubleshooting

PatchMaster includes automated scripts to resolve common environment anomalies. Run these from the project root if issues arise:

- **`./diagnose_agent_issues.sh`** - Comprehensive diagnostics mapping backend, proxy, and database health.
- **`./fix_websocket_and_groups.sh`** - Resolves real-time UI connectivity issues by updating Nginx WebSocket proxy headers.
- **`./fix_agent_registration.sh`** - Run directly on agent nodes to repair visibility and heartbeat reporting to the controller.
- **`./test_frontend_backend.sh`** - End-to-end integration tests verifying API and proxy integrity.

---

## 📚 Documentation

For deeper dives into configuration, please review our internal guides:
- [Customer Release Notes & Changelog](RELEASE_NOTES_2.0.1.md)
- [Offline / Air-Gapped Setup Guide](OFFLINE_AGENT_INSTALLATION.md)
- [Deployment Fixes & Runbooks](DEPLOYMENT_FIXES.md)
- [Stitch UI Builder Demo Summary](STITCH_UI_DEMO_SUMMARY.md)

---

<div align="center">
  <p>&copy; 2026 PatchMaster Technologies. All rights reserved.</p>
</div>