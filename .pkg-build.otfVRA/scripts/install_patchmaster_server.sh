#!/usr/bin/env bash
# Compatibility wrapper for the supported bare-metal installer.
# Keep this helper so older docs/releases still work, but route everything
# through packaging/install-bare.sh so the install logic stays in one place.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${ROOT}/packaging/install-bare.sh"

if [[ ! -x "$TARGET" ]]; then
  echo "[x] Supported installer not found at $TARGET" >&2
  exit 1
fi

echo "[!] scripts/install_patchmaster_server.sh is a compatibility wrapper."
echo "[!] Redirecting to packaging/install-bare.sh."
exec "$TARGET" "$@"
