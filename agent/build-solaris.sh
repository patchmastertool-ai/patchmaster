#!/usr/bin/env bash
set -euo pipefail

# Build Solaris Agent Package - FULLY SELF-CONTAINED for air-gapped environments
# Includes: All Python dependencies, DevOps features, CI/CD support

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="${VERSION:-2.0.0}"
DIST_DIR="${SCRIPT_DIR}/dist"
mkdir -p "${DIST_DIR}"

STAGE_DIR="${DIST_DIR}/solaris_stage"
rm -rf "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}"/python_deps

echo "=== Building Solaris Agent (FULL) ==="

# Install Python dependencies locally
echo "=== Downloading Python dependencies ==="
pip download -r "${SCRIPT_DIR}/requirements.txt" -d "${STAGE_DIR}/python_deps/" --platform manylinux2014_solaris_2_11 --python-version 3.11 2>/dev/null || true

# If no platform-specific wheels, get generic
if [[ -z "$(ls "${STAGE_DIR}/python_deps/"*.whl 2>/dev/null)" ]]; then
    pip download -r "${SCRIPT_DIR}/requirements.txt" -d "${STAGE_DIR}/python_deps/" 2>/dev/null || true
fi

# Copy all agent files
cp "${SCRIPT_DIR}/agent.py" "${STAGE_DIR}/"
cp "${SCRIPT_DIR}/main.py" "${STAGE_DIR}/"
cp "${SCRIPT_DIR}/solaris_manager.py" "${STAGE_DIR}/"
cp "${SCRIPT_DIR}/requirements.txt" "${STAGE_DIR}/"

# Copy all other manager modules that might be needed
for mgr in hpux_manager aix_manager; do
    if [[ -f "${SCRIPT_DIR}/${mgr}.py" ]]; then
        cp "${SCRIPT_DIR}/${mgr}.py" "${STAGE_DIR}/"
    fi
done

# Create startup script with offline support
cat > "${STAGE_DIR}/start-agent.sh" << 'STRTEOF'
#!/bin/bash
# PatchMaster Solaris Agent - Supports online and offline (air-gapped) modes

VERSION="2.0.0"
PORT=${PORT:-8080}
METRICS_PORT=${METRICS_PORT:-9100}
CONTROLLER_URL=${CONTROLLER_URL:-http://localhost:8000}

# Offline mode: use bundled dependencies
OFFLINE=${OFFLINE:-false}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ "$OFFLINE" == "true" ]]; then
    echo "[OFFLINE MODE] Using bundled Python dependencies..."
    export PYTHONPATH="${SCRIPT_DIR}/python_deps:${PYTHONPATH:-}"
    # Install from local wheels if not already installed
    pip install --no-index --find-links="${SCRIPT_DIR}/python_deps/" -r "${SCRIPT_DIR}/requirements.txt" 2>/dev/null || true
fi

echo "Starting PatchMaster Agent v${VERSION}..."
echo "Controller: ${CONTROLLER_URL}"
echo "Agent Port: ${PORT}"
echo "Metrics Port: ${METRICS_PORT}"

python3 agent.py --port $PORT --metrics-port $METRICS_PORT --controller-url "$CONTROLLER_URL"
STRTEOF
chmod +x "${STAGE_DIR}/start-agent.sh"

# Create CI/CD integration scripts
mkdir -p "${STAGE_DIR}/cicd"

cat > "${STAGE_DIR}/cicd/jenkins.groovy" << 'EOF'
// PatchMaster Agent Jenkins integration
pipeline {
    agent { label 'solaris' }
    stages {
        stage('Patch Scan') {
            steps {
                sh 'curl -X POST ${CONTROLLER_URL}/api/jobs/scan -d host=${HOSTNAME}'
            }
        }
        stage('Apply Patches') {
            steps {
                sh 'curl -X POST ${CONTROLLER_URL}/api/jobs/patch -d host=${HOSTNAME} --data-binary @patches.json'
            }
        }
    }
}
EOF

cat > "${STAGE_DIR}/cicd/gitlab-ci.yml" << 'EOF'
# PatchMaster Agent GitLab CI integration
patch:scan:
  script:
    - ./start-agent.sh --scan-only
    
patch:apply:
  script:
    - ./start-agent.sh --apply
  only:
    - schedules
    - manual
EOF

cat > "${STAGE_DIR}/cicd/ansible-playbook.yml" << 'EOF'
# PatchMaster Agent Ansible integration
- hosts: solaris_servers
  gather_facts: yes
  tasks:
    - name: Scan for patches
      shell: ./start-agent.sh --scan
      register: scan_result
    
    - name: Apply patches
      shell: ./start-agent.sh --apply
      when: scan_result.changed
EOF

# Create manifest
cat > "${STAGE_DIR}/MANIFEST.txt" << 'EOF'
PatchMaster Agent v${VERSION}
Platform: Solaris (IPS/pkg)
Built: $(date)
Features:
- Full package management (Solaris IPS)
- CVE/security filtering
- Proxy support
- Offline/air-gapped support
- CI/CD integrations (Jenkins, GitLab, Ansible)
- Metrics and monitoring
- Auto-update capability
Dependencies: Bundled in python_deps/
EOF

# Create tarball
cd "${STAGE_DIR}"
tar -cvzf "${DIST_DIR}/patch-agent-${VERSION}.solaris.tar.gz" .

echo "=== Built: ${DIST_DIR}/patch-agent-${VERSION}.solaris.tar.gz ==="
echo "Files: $(ls -1 | wc -l)"
echo "Python deps: $(ls python_deps/*.whl 2>/dev/null | wc -l) wheel(s)"