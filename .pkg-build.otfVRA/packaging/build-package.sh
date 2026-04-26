#!/usr/bin/env bash
###############################################################################
# PatchMaster product package builder
# Creates a customer-facing tarball from the current repo state and a fresh
# frontend build so the release artifact matches the code that was just built.
###############################################################################

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/dist"
VERSION="${VERSION:-2.0.0}"
SKIP_FRONTEND_BUILD=0

log() { printf '[INFO] %s\n' "$1"; }
success() { printf '[OK] %s\n' "$1"; }
error() { printf '[ERROR] %s\n' "$1" >&2; }

usage() {
    cat <<'EOF'
Usage: bash packaging/build-package.sh [--output DIR] [--version X.Y.Z] [--skip-frontend-build]

Options:
  --output DIR              Output directory for the product tarball (default: dist/)
  --version X.Y.Z           Override package version (default: VERSION env or 2.0.0)
  --skip-frontend-build     Reuse existing frontend/dist instead of rebuilding it
EOF
}

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || {
        error "Required command not found: $1"
        exit 1
    }
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        --skip-frontend-build)
            SKIP_FRONTEND_BUILD=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            error "Unknown argument: $1"
            usage
            exit 1
            ;;
    esac
done

require_cmd tar

run_frontend_build() {
    if [[ "$SKIP_FRONTEND_BUILD" -eq 1 ]]; then
        log "Skipping frontend build and reusing existing frontend/dist"
        return
    fi

    log "Building frontend release bundle"
    if command -v npm >/dev/null 2>&1; then
        (
            cd "$ROOT_DIR/frontend"
            npm run build
        )
        return
    fi

    if command -v cmd.exe >/dev/null 2>&1 && command -v wslpath >/dev/null 2>&1; then
        local win_frontend
        win_frontend="$(wslpath -w "$ROOT_DIR/frontend")"
        cmd.exe /c "cd /d $win_frontend && npm run build"
        return
    fi

    error "Could not find npm (or Windows cmd.exe/npm fallback) to build frontend"
    exit 1
}

copy_tree() {
    local src="$1"
    local dest_root="$2"
    shift 2
    mkdir -p "$dest_root"
    tar -C "$ROOT_DIR" -cf - "$@" "$src" | tar -C "$dest_root" -xf -
}

main() {
    local package_name="patchmaster-${VERSION}.tar.gz"
    local package_path
    local temp_dir
    local git_rev="unknown"
    local built_at

    mkdir -p "$OUTPUT_DIR"
    package_path="$OUTPUT_DIR/$package_name"
    temp_dir="$(mktemp -d "$ROOT_DIR/.pkg-build.XXXXXX")"
    built_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

    if command -v git >/dev/null 2>&1; then
        git_rev="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || printf 'unknown')"
    fi

    trap 'rm -rf "$temp_dir"' EXIT

    run_frontend_build

    if [[ ! -f "$ROOT_DIR/frontend/dist/index.html" ]]; then
        error "frontend/dist/index.html not found after build"
        exit 1
    fi

    log "Collecting product files into temporary package workspace"

    copy_tree backend "$temp_dir" \
        --exclude='backend/__pycache__' \
        --exclude='backend/.pytest_cache' \
        --exclude='backend/*.pyc'

    copy_tree frontend "$temp_dir" \
        --exclude='frontend/node_modules' \
        --exclude='frontend/coverage' \
        --exclude='frontend/src_backup_*' \
        --exclude='frontend/.vite' \
        --exclude='frontend/*.log'

    copy_tree agent "$temp_dir" \
        --exclude='agent/dist' \
        --exclude='agent/__pycache__' \
        --exclude='agent/*.pyc'

    [[ -d "$ROOT_DIR/monitoring" ]] && copy_tree monitoring "$temp_dir"
    [[ -d "$ROOT_DIR/docs/public" ]] && mkdir -p "$temp_dir/docs" && copy_tree docs/public "$temp_dir/docs"
    [[ -d "$ROOT_DIR/vendor/wheels" ]] && mkdir -p "$temp_dir/vendor" && copy_tree vendor/wheels "$temp_dir/vendor"
    [[ -d "$ROOT_DIR/packaging" ]] && copy_tree packaging "$temp_dir"
    [[ -d "$ROOT_DIR/scripts" ]] && copy_tree scripts "$temp_dir" --exclude='scripts/__pycache__'

    cp "$ROOT_DIR"/docker-compose*.yml "$temp_dir/" 2>/dev/null || true
    cp "$ROOT_DIR"/Makefile "$temp_dir/" 2>/dev/null || true
    cp "$ROOT_DIR"/README.md "$temp_dir/" 2>/dev/null || true
    cp "$ROOT_DIR"/.env.production "$temp_dir/" 2>/dev/null || true
    cp "$ROOT_DIR"/auto-setup.* "$temp_dir/" 2>/dev/null || true

    cat >"$temp_dir/BUILD-MANIFEST.txt" <<EOF
PatchMaster Product Package
Version: $VERSION
Built-At-UTC: $built_at
Git-Revision: $git_rev
Frontend-Dist: frontend/dist
EOF

    log "Creating product tarball"
    tar -czf "$package_path" \
        --exclude='__pycache__' \
        --exclude='*.pyc' \
        --exclude='.pytest_cache' \
        --exclude='node_modules' \
        --exclude='.venv' \
        --exclude='*.log' \
        --exclude='.git' \
        -C "$temp_dir" .

    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$package_path" > "${package_path}.sha256"
    fi

    success "Product package created: $package_path"
    if [[ -f "${package_path}.sha256" ]]; then
        success "Checksum written: ${package_path}.sha256"
    fi
}

main "$@"
