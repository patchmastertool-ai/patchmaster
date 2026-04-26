#!/usr/bin/env bash
# Simple RPM-style tarball for RHEL/CentOS - works offline

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="${VERSION:-2.0.0}"
DIST_DIR="${SCRIPT_DIR}/dist"
mkdir -p "${DIST_DIR}"

STAGE_DIR="${DIST_DIR}/rhel_stage"
rm -rf "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}" "${STAGE_DIR}/python_deps"

echo "=== Building RHEL/CentOS Agent ==="

cp "${SCRIPT_DIR}/agent.py" "${STAGE_DIR}/"
cp "${SCRIPT_DIR}/main.py" "${STAGE_DIR}/"
cp "${SCRIPT_DIR}/requirements.txt" "${STAGE_DIR}/"

# Download deps
pip download -r "${SCRIPT_DIR}/requirements.txt" -d "${STAGE_DIR}/python_deps/" 2>/dev/null || true

# Startup
cat > "${STAGE_DIR}/start-agent.sh" << 'EOF'
#!/bin/bash
# RHEL/CentOS - Supports offline/air-gapped
# Online: yum install python3 python3-pip -y && pip install -r requirements.txt
# Offline: yum install python3 python3-pip -y || dnf install python3 python3-pip -y
# Then: pip install --no-index --find-links=./python_deps/ -r requirements.txt
CONTROLLER_URL=${CONTROLLER_URL:-http://localhost:8000}
PORT=${PORT:-8080}
python3 agent.py --port $PORT --controller-url "$CONTROLLER_URL"
EOF
chmod +x "${STAGE_DIR}/start-agent.sh"

# CI/CD
mkdir -p "${STAGE_DIR}/cicd"
cat > "${STAGE_DIR}/cicd/jenkins.groovy" << 'EOF'
pipeline { agent { label 'rhel' }; stages { stage('Scan') { sh './start-agent.sh --scan' } } }
EOF

cat > "${STAGE_DIR}/cicd/ansible-playbook.yml" << 'EOF'
- hosts: rhel_servers; tasks: - command: ./start-agent.sh --scan
EOF

cd "${STAGE_DIR}"
tar -cvzf "${DIST_DIR}/patch-agent-${VERSION}.rhel.tar.gz" .

echo "=== Built: ${DIST_DIR}/patch-agent-${VERSION}.rhel.tar.gz ==="
du -h "${DIST_DIR}/patch-agent-${VERSION}.rhel.tar.gz"