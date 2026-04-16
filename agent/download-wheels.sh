#!/bin/bash
# Download all Python wheels needed for offline agent installation
# Run this on a machine with internet access before building the agent package

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WHEELS_DIR="${SCRIPT_DIR}/../vendor/wheels"
REQUIREMENTS="${SCRIPT_DIR}/requirements.txt"

echo "=== Downloading Python Wheels for Offline Agent Installation ==="
echo ""

# Check if requirements.txt exists
if [[ ! -f "$REQUIREMENTS" ]]; then
    echo "ERROR: requirements.txt not found at $REQUIREMENTS"
    exit 1
fi

# Create wheels directory
mkdir -p "$WHEELS_DIR"

echo "Requirements file: $REQUIREMENTS"
echo "Wheels directory: $WHEELS_DIR"
echo ""

# Check if pip is available
if ! command -v pip3 >/dev/null 2>&1; then
    echo "ERROR: pip3 not found. Please install Python 3 and pip."
    exit 1
fi

echo "Downloading wheels for all platforms..."
echo ""

# Download wheels for multiple Python versions and platforms
# This ensures compatibility with different target systems

# For Linux x86_64 (most common)
echo "[1/4] Downloading for Linux x86_64 (Python 3.8+)..."
pip3 download \
    --dest "$WHEELS_DIR" \
    --platform manylinux2014_x86_64 \
    --platform manylinux_2_17_x86_64 \
    --platform linux_x86_64 \
    --python-version 38 \
    --only-binary=:all: \
    --no-deps \
    -r "$REQUIREMENTS" 2>/dev/null || true

# For pure Python packages (platform independent)
echo "[2/4] Downloading pure Python packages..."
pip3 download \
    --dest "$WHEELS_DIR" \
    --platform any \
    --python-version 38 \
    --only-binary=:all: \
    --no-deps \
    -r "$REQUIREMENTS" 2>/dev/null || true

# Download all dependencies (including transitive)
echo "[3/4] Downloading all dependencies..."
pip3 download \
    --dest "$WHEELS_DIR" \
    -r "$REQUIREMENTS"

# Download setuptools and wheel themselves
echo "[4/4] Downloading build tools..."
pip3 download \
    --dest "$WHEELS_DIR" \
    setuptools wheel pip

echo ""
echo "=== Download Complete ==="
echo ""

# List downloaded wheels
WHEEL_COUNT=$(find "$WHEELS_DIR" -name "*.whl" | wc -l)
TOTAL_SIZE=$(du -sh "$WHEELS_DIR" | cut -f1)

echo "Downloaded wheels: $WHEEL_COUNT"
echo "Total size: $TOTAL_SIZE"
echo "Location: $WHEELS_DIR"
echo ""

# Verify all required packages are present
echo "Verifying required packages..."
MISSING=""
for pkg in Flask prometheus_client psutil requests PyYAML; do
    pkg_lower=$(echo "$pkg" | tr '[:upper:]' '[:lower:]' | tr '_' '-')
    if ! find "$WHEELS_DIR" -name "${pkg_lower}-*.whl" | grep -q .; then
        MISSING="$MISSING $pkg"
    fi
done

if [[ -n "$MISSING" ]]; then
    echo "WARNING: Missing wheels for:$MISSING"
    echo "Agent may require internet during installation!"
else
    echo "✓ All required packages present"
fi

echo ""
echo "Wheels are ready for offline agent builds."
echo "Run: bash agent/build-deb.sh"
echo ""

# Create a manifest file
cat > "$WHEELS_DIR/MANIFEST.txt" <<EOF
PatchMaster Agent Wheels
Downloaded: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Wheel count: $WHEEL_COUNT
Total size: $TOTAL_SIZE

Required packages:
$(cat "$REQUIREMENTS")

Build command:
  bash agent/build-deb.sh

This directory contains all Python dependencies needed for offline
agent installation. No internet connection required on target hosts.
EOF

echo "Manifest written to: $WHEELS_DIR/MANIFEST.txt"
