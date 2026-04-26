#!/usr/bin/env bash
# Simple Alpine build - portable tarball

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="${VERSION:-2.0.0}"
DIST_DIR="${SCRIPT_DIR}/dist"
mkdir -p "${DIST_DIR}"

STAGE_DIR="${DIST_DIR}/alpine_stage"
rm -rf "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}" "${STAGE_DIR}/python_deps"

echo "=== Building Alpine Agent ==="
cp "${SCRIPT_DIR}/agent.py" "${STAGE_DIR}/"
cp "${SCRIPT_DIR}/main.py" "${STAGE_DIR}/"
cp "${SCRIPT_DIR}/requirements.txt" "${STAGE_DIR}/"

pip download -r "${SCRIPT_DIR}/requirements.txt" -d "${STAGE_DIR}/python_deps/" 2>/dev/null || true

cat > "${STAGE_DIR}/start-agent.sh" << 'EOF'
#!/bin/sh
# apk add python3 py3-pip --no-cache
# pip3 install -r requirements.txt --no-cache-dir
# Offline: pip3 install --no-index --find-links=./python_deps/ -r requirements.txt
CONTROLLER_URL=${CONTROLLER_URL:-http://localhost:8000}
python3 agent.py --port 8080 --controller-url "$CONTROLLER_URL"
EOF
chmod +x "${STAGE_DIR}/start-agent.sh"

mkdir -p "${STAGE_DIR}/cicd"
cat > "${STAGE_DIR}/cicd/jenkins.groovy" << 'EOF'
pipeline { agent { label 'alpine' }; stages { stage('Scan') { sh './start-agent.sh --scan' } } }
EOF

cd "${STAGE_DIR}"
tar -cvzf "${DIST_DIR}/patch-agent-${VERSION}.apk" .

echo "=== Built: ${DIST_DIR}/patch-agent-${VERSION}.apk ==="
du -h "${DIST_DIR}/patch-agent-${VERSION}.apk"