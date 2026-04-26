#!/usr/bin/env bash
set -euo pipefail

# One-shot builder for PatchMaster agent artifacts: Windows EXE, Debian DEB, RPM (via Docker+fpm)
# Requires: python3, docker (for RPM), ruby/fpm inside container.
#
# Outputs:
#   dist/pyi_dist/patchmaster-agent-installer.exe
#   ../backend/static/agent-latest.deb
#   dist/patch-agent-2.0.0.rpm

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="${VERSION:-2.0.0}"
OUT_STATIC="${OUT_STATIC:-${SCRIPT_DIR}/../backend/static}"
mkdir -p "${OUT_STATIC}"

echo "=== Building Windows EXE ==="
python3 "${SCRIPT_DIR}/build_agent_artifacts.py"
cp "${SCRIPT_DIR}/dist/pyi_dist/patchmaster-agent-installer.exe" "${OUT_STATIC}/" || true

echo "=== Building DEB ==="
bash "${SCRIPT_DIR}/build-deb.sh" "${OUT_STATIC}/agent-latest.deb"

echo "=== Building RPM (Docker + fpm) ==="
bash "${SCRIPT_DIR}/build-rpm.sh"
RPM_BUILT=$(ls "${SCRIPT_DIR}/dist"/patch-agent-"${VERSION}".rpm 2>/dev/null | head -n1 || true)
if [[ -n "$RPM_BUILT" ]]; then
  cp "$RPM_BUILT" "${OUT_STATIC}/agent-latest.rpm"
  echo "RPM copied to ${OUT_STATIC}/agent-latest.rpm"
else
  echo "RPM build skipped or failed; check build-rpm.sh output."
fi

echo "=== Done ==="
echo "Artifacts:"
echo "  Windows EXE: ${OUT_STATIC}/patchmaster-agent-installer.exe"
echo "  Debian DEB:  ${OUT_STATIC}/agent-latest.deb"
echo "  RPM:         ${OUT_STATIC}/agent-latest.rpm (if built)"
