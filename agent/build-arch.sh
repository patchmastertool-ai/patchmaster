#!/usr/bin/env bash
# Simple Arch Linux - create portable tarball with bundled deps

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="${VERSION:-2.0.0}"
DIST_DIR="${SCRIPT_DIR}/dist"
mkdir -p "${DIST_DIR}"

STAGE_DIR="${DIST_DIR}/arch_stage"
rm -rf "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}" "${STAGE_DIR}/python_deps"

echo "=== Building Arch Linux Agent ==="

cp "${SCRIPT_DIR}/agent.py" "${STAGE_DIR}/"
cp "${SCRIPT_DIR}/main.py" "${STAGE_DIR}/"
cp "${SCRIPT_DIR}/requirements.txt" "${STAGE_DIR}/"

# Download deps
pip download -r "${SCRIPT_DIR}/requirements.txt" -d "${STAGE_DIR}/python_deps/" 2>/dev/null || true

# Startup script
cat > "${STAGE_DIR}/start-agent.sh" << 'EOF'
#!/bin/bash
# Arch Linux - Supports offline/air-gapped
# Online: pacman -Sy python python-pip --noconfirm && pip install -r requirements.txt
# Offline: pip install --no-index --find-links=./python_deps/ -r requirements.txt
CONTROLLER_URL=${CONTROLLER_URL:-http://localhost:8000}
PORT=${PORT:-8080}
python3 agent.py --port $PORT --controller-url "$CONTROLLER_URL"
EOF
chmod +x "${STAGE_DIR}/start-agent.sh"

# CI/CD
mkdir -p "${STAGE_DIR}/cicd"
cat > "${STAGE_DIR}/cicd/jenkins.groovy" << 'EOF'
pipeline { agent { label 'arch' }; stages { stage('Scan') { sh './start-agent.sh --scan' } } }
EOF

cat > "${STAGE_DIR}/cicd/ansible-playbook.yml" << 'EOF'
- hosts: arch_servers; tasks: - shell: ./start-agent.sh --scan
EOF

cd "${STAGE_DIR}"
tar -cvzf "${DIST_DIR}/patch-agent-${VERSION}.txz" .

echo "=== Built: ${DIST_DIR}/patch-agent-${VERSION}.txz ==="
du -h "${DIST_DIR}/patch-agent-${VERSION}.txz"