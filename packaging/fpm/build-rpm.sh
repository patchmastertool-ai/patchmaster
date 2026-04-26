#!/bin/bash
set -euo pipefail

VERSION=${1:-2.0.0}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$ROOT/../.." && pwd)"

DEFAULT_WHEEL_DIR="$PROJECT_ROOT/vendor/wheels"
CACHE_WHEELS="$HOME/.cache/pip/wheels"
if [[ -z "${PIP_FIND_LINKS:-}" ]]; then
  if [[ -d "$DEFAULT_WHEEL_DIR" ]]; then
    PIP_FIND_LINKS="$DEFAULT_WHEEL_DIR"
  elif [[ -d "$CACHE_WHEELS" ]]; then
    PIP_FIND_LINKS="$CACHE_WHEELS"
  fi
fi
if [[ -z "${PIP_FIND_LINKS:-}" ]]; then
  echo "[rpm] ERROR: PIP_FIND_LINKS not set and no cached wheels found (vendor/wheels or ~/.cache/pip/wheels)."
  exit 1
fi
PIP_OPTS=${PIP_OPTS:---no-index}
if [[ -n "${PIP_FIND_LINKS:-}" ]]; then
  PIP_OPTS="$PIP_OPTS --find-links ${PIP_FIND_LINKS}"
fi
export PIP_FIND_LINKS
export PIP_DISABLE_PIP_VERSION_CHECK=1

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

INSTALL_DIR="/opt/patch-agent"

mkdir -p "$WORK/root${INSTALL_DIR}"
mkdir -p "$WORK/root/etc/patch-agent"
mkdir -p "$WORK/root/usr/lib/systemd/system"
mkdir -p "$WORK/root/usr/bin"

cp -f "$PROJECT_ROOT/agent/agent.py" "$WORK/root${INSTALL_DIR}/agent.py"
cp -f "$PROJECT_ROOT/agent/main.py" "$WORK/root${INSTALL_DIR}/main.py"
cp -f "$PROJECT_ROOT/agent/requirements.txt" "$WORK/root${INSTALL_DIR}/requirements.txt"
cp -f "$PROJECT_ROOT/agent/__init__.py" "$WORK/root${INSTALL_DIR}/__init__.py" 2>/dev/null || true
[[ -f "$PROJECT_ROOT/packaging/rhel/selinux/apply.sh" ]] && \
  cp -f "$PROJECT_ROOT/packaging/rhel/selinux/apply.sh" "$WORK/root${INSTALL_DIR}/selinux-apply.sh" || true
cp -f "$PROJECT_ROOT/agent/uninstall_agent.sh" "$WORK/root${INSTALL_DIR}/uninstall.sh"
chmod +x "$WORK/root${INSTALL_DIR}/uninstall.sh"

# Create a bundled virtualenv with all dependencies.
# Use --copies to avoid symlink issues on NTFS/WSL mounts
python3 -m venv --copies "$WORK/root${INSTALL_DIR}/venv"
echo "[rpm] Installing agent dependencies into bundled virtualenv..."
"$WORK/root${INSTALL_DIR}/venv/bin/python" -m pip install $PIP_OPTS -r "$PROJECT_ROOT/agent/requirements.txt"

# Reduce size
rm -rf "$WORK/root${INSTALL_DIR}/venv/share" 2>/dev/null || true
find "$WORK/root${INSTALL_DIR}/venv" -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
find "$WORK/root${INSTALL_DIR}/venv" -name '*.pyc' -delete 2>/dev/null || true

# Wrapper scripts
cat > "$WORK/root${INSTALL_DIR}/run-heartbeat.sh" <<'WRAPPER'
#!/bin/bash
exec /opt/patch-agent/venv/bin/python3 /opt/patch-agent/main.py "$@"
WRAPPER
chmod +x "$WORK/root${INSTALL_DIR}/run-heartbeat.sh"

cat > "$WORK/root${INSTALL_DIR}/run-api.sh" <<'WRAPPER'
#!/bin/bash
exec /opt/patch-agent/venv/bin/python3 /opt/patch-agent/agent.py --port 8080 --metrics-port 9100 "$@"
WRAPPER
chmod +x "$WORK/root${INSTALL_DIR}/run-api.sh"

cat > "$WORK/root/usr/bin/patch-agent" <<'WRAPPER'
#!/bin/bash
exec /opt/patch-agent/venv/bin/python3 /opt/patch-agent/agent.py --port 8080 --metrics-port 9100 "$@"
WRAPPER
chmod +x "$WORK/root/usr/bin/patch-agent"

cat > "$WORK/root/usr/bin/patch-agent-heartbeat" <<'WRAPPER'
#!/bin/bash
exec /opt/patch-agent/venv/bin/python3 /opt/patch-agent/main.py "$@"
WRAPPER
chmod +x "$WORK/root/usr/bin/patch-agent-heartbeat"

cat > "$WORK/root/usr/bin/patch-agent-uninstall" <<'WRAPPER'
#!/bin/bash
exec /opt/patch-agent/uninstall.sh
WRAPPER
chmod +x "$WORK/root/usr/bin/patch-agent-uninstall"

# Systemd units
cp -f "$PROJECT_ROOT/packaging/rhel/patch-agent.service" "$WORK/root/usr/lib/systemd/system/patch-agent.service"
cp -f "$PROJECT_ROOT/packaging/rhel/patch-agent-heartbeat.service" "$WORK/root/usr/lib/systemd/system/patch-agent-heartbeat.service"

# Build RPM (prefer fpm; fallback to rpmbuild)
if command -v fpm >/dev/null 2>&1; then
  rm -f patch-agent-*.rpm
  fpm --force -s dir -t rpm -n patch-agent -v "$VERSION" --description "PatchMaster Agent" --rpm-os linux --after-install "$ROOT/../rhel/postinst.sh" -C "$WORK/root" opt etc usr
  RPM_OUT=$(ls *.rpm | head -n1)
else
  echo "[rpm] fpm not found; using rpmbuild fallback"
  RPMBUILD_TOP="$WORK/rpmbuild"
  mkdir -p "$RPMBUILD_TOP"/{BUILD,RPMS,SRPMS,SOURCES,SPECS}
  SPEC="$RPMBUILD_TOP/SPECS/patch-agent.spec"
  cat > "$SPEC" <<'SPECFILE'
Name: patch-agent
Version: __VERSION__
Release: 1
Summary: PatchMaster Agent
License: Proprietary
BuildArch: x86_64
Requires: python3

%description
PatchMaster Agent (offline package with bundled virtualenv).

%prep
%build
%install
mkdir -p %{buildroot}
cp -a __BUILDROOT__/* %{buildroot}

%files
/opt/patch-agent
/etc/patch-agent
/usr/lib/systemd/system/patch-agent.service
/usr/lib/systemd/system/patch-agent-heartbeat.service
/usr/bin/patch-agent
/usr/bin/patch-agent-heartbeat
/usr/bin/patch-agent-uninstall

%post
/usr/sbin/useradd -r -s /usr/sbin/nologin -d /opt/patch-agent patchagent >/dev/null 2>&1 || true
/usr/bin/install -d -o patchagent -g patchagent /var/log/patch-agent
/usr/bin/install -d -o patchagent -g patchagent /var/lib/patch-agent
/usr/bin/install -d -o patchagent -g patchagent /var/lib/patch-agent/snapshots
/usr/bin/install -d -o patchagent -g patchagent /var/lib/patch-agent/offline-pkgs
/usr/bin/mkdir -p /etc/patch-agent
/usr/bin/chown root:root /etc/patch-agent >/dev/null 2>&1 || true
/usr/bin/chmod 755 /etc/patch-agent >/dev/null 2>&1 || true
/bin/systemctl daemon-reload >/dev/null 2>&1 || true
/bin/systemctl enable patch-agent.service >/dev/null 2>&1 || true
/bin/systemctl enable patch-agent-heartbeat.service >/dev/null 2>&1 || true
/bin/systemctl restart patch-agent.service >/dev/null 2>&1 || true
/bin/systemctl restart patch-agent-heartbeat.service >/dev/null 2>&1 || true

%postun
/bin/systemctl daemon-reload >/dev/null 2>&1 || true
SPECFILE
  sed -i "s|__VERSION__|$VERSION|g" "$SPEC"
  sed -i "s|__BUILDROOT__|$WORK/root|g" "$SPEC"
  rpmbuild -bb "$SPEC" --buildroot "$WORK/root" --define "_topdir $RPMBUILD_TOP"
  RPM_OUT=$(find "$RPMBUILD_TOP/RPMS" -type f -name "*.rpm" | head -n1)
fi

mkdir -p "$PROJECT_ROOT/backend/static"
mv "$RPM_OUT" "$PROJECT_ROOT/backend/static/agent-latest.rpm"
