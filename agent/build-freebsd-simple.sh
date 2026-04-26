#!/usr/bin/env bash
# Quick FreeBSD build - simple tarball with bundled deps

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="${VERSION:-2.0.0}"
DIST_DIR="${SCRIPT_DIR}/dist"
mkdir -p "${DIST_DIR}"

STAGE_DIR="${DIST_DIR}/freebsd_stage"
rm -rf "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}" "${STAGE_DIR}/python_deps"

echo "=== Building FreeBSD Agent ==="

# Copy files
cp "${SCRIPT_DIR}/agent.py" "${STAGE_DIR}/"
cp "${SCRIPT_DIR}/main.py" "${STAGE_DIR}/"
cp "${SCRIPT_DIR}/requirements.txt" "${STAGE_DIR}/"

# Download deps
pip download -r "${SCRIPT_DIR}/requirements.txt" -d "${STAGE_DIR}/python_deps/" 2>/dev/null || true

# Startup
cat > "${STAGE_DIR}/start-agent.sh" << 'EOF'
#!/bin/sh
# FreeBSD - Supports offline/air-gapped
# Online: pkg install -y python3 py38-pip && pip3 install -r requirements.txt
# Offline: pkg install -y python3 py38-pip 
# Then: pip3 install --no-index --find-links=./python_deps/ -r requirements.txt
CONTROLLER_URL=${CONTROLLER_URL:-http://localhost:8000}
PORT=${PORT:-8080}
python3 agent.py --port $PORT --controller-url "$CONTROLLER_URL"
EOF
chmod +x "${STAGE_DIR}/start-agent.sh"

# CI/CD
mkdir -p "${STAGE_DIR}/cicd"
cat > "${STAGE_DIR}/cicd/jenkins.groovy" << 'EOF'
pipeline { agent { label 'freebsd' }; stages { stage('Scan') { sh './start-agent.sh --scan' } } }
EOF

cat > "${STAGE_DIR}/cicd/ansible-playbook.yml" << 'EOF'
- hosts: freebsd_servers; tasks: - command: ./start-agent.sh --scan
EOF

cd "${STAGE_DIR}"
tar -cvzf "${DIST_DIR}/patch-agent-${VERSION}.freebsd.tar.gz" .

echo "=== Built: ${DIST_DIR}/patch-agent-${VERSION}.freebsd.tar.gz ==="
du -h "${DIST_DIR}/patch-agent-${VERSION}.freebsd.tar.gz"