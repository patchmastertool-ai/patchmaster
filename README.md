<div align="center">

# 🛡️ PatchMaster Enterprise
**Next-Generation, High-Availability Patch Management & Telemetry Platform**

[![Version](https://img.shields.io/badge/version-2.0.17-blue.svg?style=for-the-badge)](https://github.com/patchmastertool-ai/patchmaster)
[![Status](https://img.shields.io/badge/status-Production_Ready-success.svg?style=for-the-badge)]()
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20UNIX%20%7C%20Windows-lightgrey?style=for-the-badge)]()
[![License](https://img.shields.io/badge/license-Proprietary-red.svg?style=for-the-badge)]()

*A zero-trust, air-gap resilient infrastructure command center enabling centralized control, real-time WebSocket telemetry, and secure deployment orchestration across heterogeneous server fleets.*

</div>

<br/>

## 📖 Executive Overview

Managing highly distributed, heterogeneous, and secure environments demands more than standard package managers. PatchMaster Enterprise is an **infrastructure command center** built to unify deployment strategies, mitigate fragmentation, and enforce rigorous compliance policies globally.

Engineered to operate seamlessly on standard cloud topologies as well as **fully air-gapped, dark-site deployments**, the platform utilizes a proprietary offline dependency mapping strategy. This allows PatchMaster to securely deliver mission-critical patches to completely isolated systems without exposing them to external threat vectors.

---

## 🏛️ System Architecture

PatchMaster follows a decoupled, resilient microservices architecture. It utilizes asynchronous event loops for high-throughput concurrency and WebSockets for real-time edge telemetry.

```mermaid
graph TD
    %% Define styles
    classDef frontend fill:#06122d,stroke:#7bd0ff,stroke-width:2px,color:#dee5ff;
    classDef backend fill:#05183c,stroke:#10b981,stroke-width:2px,color:#dee5ff;
    classDef db fill:#1e1e1e,stroke:#f59e0b,stroke-width:2px,color:#dee5ff;
    classDef agent fill:#2d3748,stroke:#a78bfa,stroke-width:2px,color:#dee5ff;
    
    %% Nodes
    User([System Administrator])
    Nginx[Nginx Reverse Proxy / Load Balancer]
    
    subgraph "Presentation Layer"
        SPA[React + Vite SPA<br/>Command Horizon UI]:::frontend
    end
    
    subgraph "Application Layer"
        API[FastAPI / Flask REST Core]:::backend
        WS[WebSocket Telemetry Hub]:::backend
    end
    
    subgraph "Data Layer"
        Postgres[(PostgreSQL 12+<br/>Row-Level Lock Enabled)]:::db
        Prometheus[Prometheus Metrics]:::db
    end
    
    subgraph "Edge / Target Nodes"
        Linux[Linux Agent]:::agent
        Unix[AIX/Solaris/HP-UX]:::agent
        Win[Windows Agent]:::agent
    end
    
    %% Relationships
    User -- HTTPS --> Nginx
    Nginx -- Port 3000 --> SPA
    Nginx -- /api/ --> API
    Nginx -- Upgrade: websocket --> WS
    
    SPA -- REST Calls --> API
    SPA -- WSS Connect --> WS
    
    API -- Read/Write --> Postgres
    API -- Query --> Prometheus
    
    Linux -- Heartbeat / API --> Nginx
    Unix -- Heartbeat / API --> Nginx
    Win -- Heartbeat / API --> Nginx
```

---

## 🚀 Advanced Capabilities

### 1. 🛡️ Zero-Trust Air-Gapped Resiliency (`/vendor`)
We recognize that highly classified infrastructure lacks internet egress. PatchMaster implements a rigorous offline bundle strategy:
- **Pre-Compiled Wheels:** The `./vendor/vendor/wheels/` directory acts as a local PyPI mirror containing verified, signed binaries.
- **Self-Contained Agents:** Cross-platform Python agents (~35MB) are packaged autonomously with their required runtime environment, guaranteeing deployments on systems with zero external connectivity.

### 2. 🚦 Canary Testing & Phased Rollouts
Deploying patches blindly is a critical operational risk. PatchMaster's API (`backend/api/canary_testing.py`) includes a robust multi-phase rollout pipeline:
- **Phased Triggers:** Automatically deploy to a 5% host subset, monitor telemetry for anomalies, and autonomously promote the patch to 100% of the fleet if healthy.
- **Automated Fallback:** If the heartbeat or service status reports failure post-patch, the rollout is suspended automatically to prevent cascade failures.

### 3. 📡 Real-Time Edge Telemetry
Leveraging Python's asynchronous capabilities and Nginx HTTP/1.1 upgrade headers, the platform maintains persistent, low-latency WebSocket connections with target nodes.
- **Live Observability:** Instantly view CPU limits, memory leaks, and registration statuses natively within the *Command Horizon* UI.

### 4. 🎨 Stitch UI Builder (AI-Powered)
PatchMaster isn't just an API; it includes a sophisticated, React-based frontend development suite. The internal **Stitch UI Builder** provides an AI-integrated environment to dynamically generate syntax-validated, high-density React components on the fly, accelerating custom administrative dashboard creation.

---

## ⚙️ Deployment Matrix

PatchMaster natively supports a variety of deployment topologies. 

<details>
<summary><b>🐳 Option A: High Availability Docker Swarm / Compose</b> <i>(Click to expand)</i></summary>
<br>
The optimal production deployment utilizes isolated containers for the API, Database, and Proxy components.

```yaml
# Extract from docker-compose.ha.yml
services:
  backend:
    build: 
      context: ./backend
    deploy:
      replicas: 3 # Load-balanced backend replicas
    environment:
      - DATABASE_URL=postgresql://patchmaster:${DB_PASSWORD}@postgres:5432/patchmaster
      - ENABLE_WEBSOCKETS=true
    networks:
      - pm_internal

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
      - frontend
```
**Execution:** `docker-compose -f docker-compose.ha.yml up -d`
</details>

<details>
<summary><b>💻 Option B: Bare-Metal Legacy Deployment</b> <i>(Click to expand)</i></summary>
<br>
For systems without container orchestration, use the automated bash bootstrapper which natively configures SystemD and Nginx reverse proxy headers.

```bash
# Decompress release package
tar -xzf patchmaster-2.0.1.tar.gz && cd patchmaster-2.0.1

# Run the hyper-visor setup pipeline
sudo bash auto-setup.sh
```
</details>

<details>
<summary><b>🤖 Option C: Heterogeneous Agent Compilation</b> <i>(Click to expand)</i></summary>
<br>
Agents are dynamically compiled via the `agent` tooling to support diverse kernels.

```bash
cd agent
# Produce .deb and .rpm artifacts
bash build-deb-fixed.sh && bash build-rpm.sh 
# Produce static tarballs for esoteric UNIX (Solaris/AIX)
bash build-all-fixed.sh 2.0.1
```
</details>

---

## 🛠️ Advanced Telemetry & Diagnostics

PatchMaster provides low-level scripts to detect environment desynchronization, WebSocket proxy failures, and agent ghosting:

| Diagnostic Tool | Target Context | Description |
|-----------------|----------------|-------------|
| `./diagnose_agent_issues.sh` | Controller | Probes Postgres, FastApi edge, and SystemD to ensure HA clustering health. |
| `./fix_websocket_and_groups.sh` | Nginx Edge | Rebuilds `Upgrade $http_upgrade` proxy paths to resolve WS handshake failures. |
| `./fix_agent_registration.sh` | Target Node | Forces a hard reset of local state and aggressively attempts handshake with the Controller. |
| `./test_frontend_backend.sh` | Controller | Executes end-to-end integration tests confirming API contract integrity. |

---

## 🛡️ Security Posture

- **RBAC & Token Management:** JWT-based stateless authentication with strict 60-minute expiry windows.
- **Hardened Configurations:** Automated cryptographic generation for PostgreSQL and Grafana default parameters.
- **CVE Mitigation:** Deep codebase scans preventing basic `except:` blocks, enforcing sanitized database inputs to prevent SQLi.

---

## 📚 Deep Dive Documentation

For system administrators and integration engineers, detailed references are available:
- **[Architectural Release Notes](RELEASE_NOTES_2.0.1.md)** - Low-level changes regarding WebSocket fixes and Agent Registration stability.
- **[Dark Site Deployment Guide](OFFLINE_AGENT_INSTALLATION.md)** - Operational procedures for air-gapped data centers.
- **[Stitch Integration Spec](STITCH_UI_DEMO_SUMMARY.md)** - Documentation on the AI-powered UI generation capabilities.

<br>

<div align="center">
  <sub><b>Built by the PatchMaster Engineering Team</b></sub><br/>
  <sup>Enterprise IT Infrastructure Modernization | Proprietary Software</sup>
</div>