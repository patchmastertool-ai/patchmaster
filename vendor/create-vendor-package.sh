#!/bin/bash
###############################################################################
#  PatchMaster Vendor Portal — Package Builder
#  Creates a deployable tarball: dist/patchmaster-vendor-<version>.tar.gz
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION="${1:-2.0.1}"
OUTPUT_DIR="$SCRIPT_DIR/dist"
PKG_NAME="patchmaster-vendor-${VERSION}"
OUTPUT="$OUTPUT_DIR/${PKG_NAME}.tar.gz"

echo "=== Building PatchMaster Vendor Portal ${VERSION} ==="

mkdir -p "$OUTPUT_DIR"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PKG="$TMP/$PKG_NAME"
mkdir -p "$PKG"

# Copy all vendor files
cp "$SCRIPT_DIR/app.py"                "$PKG/"
cp "$SCRIPT_DIR/generate-license.py"   "$PKG/"
cp "$SCRIPT_DIR/generate-pm2-keys.py"  "$PKG/" 2>/dev/null || true
cp "$SCRIPT_DIR/requirements.txt"      "$PKG/"
cp "$SCRIPT_DIR/install-vendor.sh"     "$PKG/"
cp "$SCRIPT_DIR/uninstall-vendor.sh"   "$PKG/" 2>/dev/null || true
cp "$SCRIPT_DIR/update-vendor.sh"      "$PKG/" 2>/dev/null || true
cp "$SCRIPT_DIR/Makefile"              "$PKG/"
cp "$SCRIPT_DIR/.env.example"          "$PKG/"
cp "$SCRIPT_DIR/docker-compose.yml"    "$PKG/"
cp "$SCRIPT_DIR/Dockerfile"            "$PKG/" 2>/dev/null || true
cp "$SCRIPT_DIR/nginx.conf"            "$PKG/"

# Copy templates
cp -r "$SCRIPT_DIR/templates"          "$PKG/"

# Copy static files if they exist
[[ -d "$SCRIPT_DIR/static" ]] && cp -r "$SCRIPT_DIR/static" "$PKG/"

# Copy wheels if they exist
[[ -d "$SCRIPT_DIR/wheels" ]] && cp -r "$SCRIPT_DIR/wheels" "$PKG/"

# Copy license authority env if it exists
[[ -f "$SCRIPT_DIR/../.license-authority.env" ]] && \
    cp "$SCRIPT_DIR/../.license-authority.env" "$PKG/patchmaster-license-authority.env"

# Write version file
cat > "$PKG/VERSION" <<EOF
VENDOR_PORTAL_VERSION=${VERSION}
BUILT_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

# Write README
cat > "$PKG/README.txt" <<'EOF'
PatchMaster Vendor Portal
=========================

QUICK START (Bare Metal):
--------------------------
1. sudo bash install-vendor.sh
2. Access at: http://<server-ip>:8080
3. Login with credentials shown at end of install

QUICK START (Docker):
---------------------
1. cp .env.example .env
2. Edit .env with your credentials
3. docker compose up -d
4. Access at: http://<server-ip>:8080

GENERATE PM2 LICENSE:
---------------------
python generate-license.py --plan testing --customer "Customer Name"

GENERATE NEW KEYS (first time setup):
--------------------------------------
python generate-pm2-keys.py

PLANS AVAILABLE:
----------------
- testing: 30 days, unlimited hosts, portable
- poc:     14 days, unlimited hosts, portable
- annual:  365 days, hardware-bound
- 3year:   1095 days, hardware-bound (10% off)
- 5year:   1825 days, hardware-bound (20% off)

TIERS AVAILABLE:
----------------
- basic:          Core patching, 10 hosts
- basic_devops:   Basic + CI/CD, 10 hosts
- standard:       Enterprise, 100 hosts
- standard_devops: Standard + DevOps, 100 hosts
- enterprise:     All features, unlimited hosts

IMPORTANT:
----------
- Only PM2 (encrypted) licenses are supported
- PM1 licenses are rejected by PatchMaster backend
- Keep LICENSE_SIGN_PRIVATE_KEY and LICENSE_DECRYPT_PRIVATE_KEY secret
- LICENSE_VERIFY_PUBLIC_KEY and LICENSE_ENCRYPT_PUBLIC_KEY go in PatchMaster backend
EOF

chmod +x "$PKG/install-vendor.sh"
[[ -f "$PKG/uninstall-vendor.sh" ]] && chmod +x "$PKG/uninstall-vendor.sh"
[[ -f "$PKG/update-vendor.sh" ]] && chmod +x "$PKG/update-vendor.sh"

# Build tarball
tar -czf "$OUTPUT" -C "$TMP" "$PKG_NAME"

# Checksum
if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$OUTPUT" > "${OUTPUT}.sha256"
fi

SIZE=$(du -sh "$OUTPUT" 2>/dev/null | cut -f1 || echo "?")
echo ""
echo "=== Build Complete ==="
echo "    Package: $OUTPUT"
echo "    Size:    $SIZE"
echo ""
echo "Deploy:"
echo "  scp $OUTPUT root@<server>:/tmp/"
echo "  ssh root@<server> 'cd /tmp && tar -xzf ${PKG_NAME}.tar.gz && cd ${PKG_NAME} && bash install-vendor.sh'"
