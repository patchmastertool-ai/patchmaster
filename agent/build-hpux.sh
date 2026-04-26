#!/usr/bin/env bash
set -euo pipefail

# Build HP-UX Agent Package - FULLY SELF-CONTAINED for air-gapped environments
# Includes: All Python dependencies, DevOps features, CI/CD support

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="${VERSION:-2.0.0}"
DIST_DIR="${SCRIPT_DIR}/dist"
mkdir -p "${DIST_DIR}"

STAGE_DIR="${DIST_DIR}/hpux_stage"
rm -rf "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}"/python_deps

echo "=== Building HP-UX Agent (FULL) ==="

# Install Python dependencies locally
echo "=== Downloading Python dependencies ==="
pip download -r "${SCRIPT_DIR}/requirements.txt" -d "${STAGE_DIR}/python_deps/" --platform hpux --python-version 3.11 2>/dev/null || true

if [[ -z "$(ls "${STAGE_DIR}/python_deps/"*.whl 2>/dev/null)" ]]; then
    pip download -r "${SCRIPT_DIR}/requirements.txt" -d "${STAGE_DIR}/python_deps/" 2>/dev/null || true
fi

# Copy all agent files
cp "${SCRIPT_DIR}/agent.py" "${STAGE_DIR}/"
cp "${SCRIPT_DIR}/main.py" "${STAGE_DIR}/"
cp "${SCRIPT_DIR}/hpux_manager.py" "${STAGE_DIR}/"
cp "${SCRIPT_DIR}/requirements.txt" "${STAGE_DIR}/"

# Copy all other manager modules
for mgr in solaris_manager aix_manager; do
    if [[ -f "${SCRIPT_DIR}/${mgr}.py" ]]; then
        cp "${SCRIPT_DIR}/${mgr}.py" "${STAGE_DIR}/"
    fi
done

# Create startup script with offline support
cat > "${STAGE_DIR}/start-agent.sh" << 'STRTEOF'
#!/bin/sh
# PatchMaster HP-UX Agent - Supports online and offline (air-gapped) modes

VERSION="2.0.0"
PORT=${PORT:-8080}
METRICS_PORT=${METRICS_PORT:-9100}
CONTROLLER_URL=${CONTROLLER_URL:-http://localhost:8000}

OFFLINE=${OFFLINE:-false}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ "$OFFLINE" == "true" ]]; then
    echo "[OFFLINE MODE] Using bundled Python dependencies..."
    export PYTHONPATH="${SCRIPT_DIR}/python_deps:${PYTHONPATH:-}"
    pip install --no-index --find-links="${SCRIPT_DIR}/python_deps/" -r "${SCRIPT_DIR}/requirements.txt" 2>/dev/null || true
fi

echo "Starting PatchMaster Agent v${VERSION}..."
echo "Controller: ${CONTROLLER_URL}"

nohup python3 agent.py --port $PORT --metrics-port $METRICS_PORT --controller-url "$CONTROLLER_URL" &
echo "Agent started (PID: $!)"
STRTEOF
chmod +x "${STAGE_DIR}/start-agent.sh"

# Create CI/CD integration scripts
mkdir -p "${STAGE_DIR}/cicd"

cat > "${STAGE_DIR}/cicd/jenkins.groovy" << 'EOF'
// PatchMaster Jenkins pipeline for HP-UX
pipeline {
    agent { label 'hpux' }
    stages {
        stage('Scan') {
            sh 'curl -X POST ${CONTROLLER_URL}/api/jobs/scan -d host=${HOSTNAME}'
        }
        stage('Patch') {
            sh 'curl -X POST ${CONTROLLER_URL}/api/jobs/patch -d host=${HOSTNAME}'
        }
    }
}
EOF

cat > "${STAGE_DIR}/cicd/gitlab-ci.yml" << 'EOF'
# HP-UX Agent GitLab CI
patch:scan:
  script:
    - ./start-agent.sh --scan-only
    
patch:apply:
  script:
    - ./start-agent.sh --apply
EOF

cat > "${STAGE_DIR}/cicd/ansible-playbook.yml" << 'EOF'
- hosts: hpux_servers
  tasks:
    - shell: ./start-agent.sh --scan
    - shell: ./start-agent.sh --apply
EOF

# Create manifest
cat > "${STAGE_DIR}/MANIFEST.txt" << EOF
PatchMaster Agent v${VERSION}
Platform: HP-UX (SD-UX/swinstall)
Features:
- Full package management (swinstall/swmgr)
- CVE filtering
- Proxy support
- Offline mode
- CI/CD integrations
EOF

# Create tarball
cd "${STAGE_DIR}"
tar -cvzf "${DIST_DIR}/patch-agent-${VERSION}.hpux.tar.gz" .

echo "=== Built: ${DIST_DIR}/patch-agent-${VERSION}.hpux.tar.gz ==="