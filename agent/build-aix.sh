#!/usr/bin/env bash
set -euo pipefail

# Build AIX Agent Package - FULLY SELF-CONTAINED for air-gapped environments

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="${VERSION:-2.0.0}"
DIST_DIR="${SCRIPT_DIR}/dist"
mkdir -p "${DIST_DIR}"

STAGE_DIR="${DIST_DIR}/aix_stage"
rm -rf "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}"/python_deps

echo "=== Building AIX Agent (FULL) ==="

pip download -r "${SCRIPT_DIR}/requirements.txt" -d "${STAGE_DIR}/python_deps/" 2>/dev/null || true

# Copy all agent files
cp "${SCRIPT_DIR}/agent.py" "${STAGE_DIR}/"
cp "${SCRIPT_DIR}/main.py" "${STAGE_DIR}/"
cp "${SCRIPT_DIR}/aix_manager.py" "${STAGE_DIR}/"
cp "${SCRIPT_DIR}/requirements.txt" "${STAGE_DIR}/"

for mgr in solaris_manager hpux_manager; do
    [[ -f "${SCRIPT_DIR}/${mgr}.py" ]] && cp "${SCRIPT_DIR}/${mgr}.py" "${STAGE_DIR}/"
done

# Startup script
cat > "${STAGE_DIR}/start-agent.sh" << 'STRTEOF'
#!/bin/ksh
VERSION="2.0.0"
PORT=${PORT:-8080}
METRICS_PORT=${METRICS_PORT:-9100}
CONTROLLER_URL=${CONTROLLER_URL:-http://localhost:8000}

OFFLINE=${OFFLINE:-false}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ "$OFFLINE" == "true" ]]; then
    export PYTHONPATH="${SCRIPT_DIR}/python_deps:${PYTHONPATH:-}"
    pip install --no-index --find-links="${SCRIPT_DIR}/python_deps/" -r "${SCRIPT_DIR}/requirements.txt" 2>/dev/null || true
fi

echo "Starting PatchMaster v${VERSION}..."
nohup python3 agent.py --port $PORT --metrics-port $METRICS_PORT --controller-url "$CONTROLLER_URL" &
STRTEOF
chmod +x "${STAGE_DIR}/start-agent.sh"

# CI/CD
mkdir -p "${STAGE_DIR}/cicd"
cat > "${STAGE_DIR}/cicd/jenkins.groovy" << 'EOF'
pipeline { agent { label 'aix' }; stages { stage('Scan') { sh './start-agent.sh --scan' } } }
EOF
cat > "${STAGE_DIR}/cicd/gitlab-ci.yml" << 'EOF'
patch:scan: script: ./start-agent.sh --scan
EOF
cat > "${STAGE_DIR}/cicd/ansible-playbook.yml" << 'EOF'
- hosts: aix_servers tasks: - shell: ./start-agent.sh --scan
EOF

cat > "${STAGE_DIR}/MANIFEST.txt" << EOF
PatchMaster Agent v${VERSION}
Platform: AIX (installp/NIM)
Features: Full package management, CVE filtering, Proxy, Offline, CI/CD
EOF

cd "${STAGE_DIR}"
tar -cvzf "${DIST_DIR}/patch-agent-${VERSION}.aix.tar.gz" .

echo "=== Built: ${DIST_DIR}/patch-agent-${VERSION}.aix.tar.gz ==="