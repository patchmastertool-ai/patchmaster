#!/bin/bash
# Create Complete Package with All Dependencies (Wheels, node_modules, etc.)
# This package is ready to deploy without internet access

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
PACKAGE_NAME="patchmaster-complete-${TIMESTAMP}.tar.gz"

echo "=== Creating Complete Self-Contained Package ==="
echo "Package: $PACKAGE_NAME"
echo "This will include ALL dependencies (wheels, node_modules, etc.)"
echo ""

# Create tar with everything needed for offline installation
tar -czf "$PACKAGE_NAME" \
  --exclude='.git' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.pytest_cache' \
  --exclude='reports' \
  --exclude='*.tar.gz' \
  --exclude='*.zip' \
  --exclude='dist/pyi_*' \
  --exclude='agent/dist/pyi_*' \
  --exclude='agent/dist/winbuild_venv' \
  --exclude='.build-release-venv' \
  --exclude='.pdf-tools-venv' \
  --exclude='.tmp_pytest_vendor' \
  agent/ \
  backend/ \
  frontend/ \
  vendor/ \
  scripts/ \
  packaging/ \
  monitoring/ \
  docs/ \
  docker-compose*.yml \
  Makefile \
  README.md \
  PRODUCTION.md \
  LICENSE \
  .gitignore \
  .env.production \
  DEVELOPER_SETUP_GUIDE.md \
  WORKSPACE_BACKUP_INFO.md \
  GIT_PUSH_INSTRUCTIONS.md \
  QUICK_START.md \
  auto-setup.sh

if [ -f "$PACKAGE_NAME" ]; then
    SIZE=$(du -h "$PACKAGE_NAME" | cut -f1)
    echo ""
    echo "=== Package Created Successfully ==="
    echo "File: $PACKAGE_NAME"
    echo "Size: $SIZE"
    echo ""
    echo "✓ Includes ALL wheel files (Python packages)"
    echo "✓ Includes node_modules (if present)"
    echo "✓ Includes all source code"
    echo "✓ Includes auto-setup.sh script"
    echo "✓ Ready for offline/air-gapped deployment"
    echo ""
    echo "To deploy on another machine:"
    echo "  1. Transfer: $PACKAGE_NAME"
    echo "  2. Extract: tar -xzf $PACKAGE_NAME"
    echo "  3. Run: bash auto-setup.sh"
    echo ""
else
    echo "Error: Package was not created"
    exit 1
fi
