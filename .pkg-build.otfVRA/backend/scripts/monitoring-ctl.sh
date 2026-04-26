#!/usr/bin/env bash
# Simple monitoring control script for Prometheus/Grafana.
# Actions: status|start|stop|install|restart|reload-dashboards
# Args: all|prometheus|grafana

set -uo pipefail

ACTION="${1:-status}"
TARGET="${2:-all}"
PM_INSTALL_DIR="${INSTALL_DIR:-/opt/patchmaster}"
BACKEND_ENV_FILE="${PM_BACKEND_ENV_FILE:-${PM_INSTALL_DIR}/backend/.env}"

if [ -f "$BACKEND_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$BACKEND_ENV_FILE"
  set +a
fi

# Hard-set unit names to avoid mismatches on hosts where both names are present.
PROM_SERVICE="${PROM_SERVICE_NAME:-prometheus.service}"
GRAF_SERVICE="${GRAF_SERVICE_NAME:-grafana-server.service}"
PROM_PORT="${PROMETHEUS_PORT:-9090}"
GRAF_PORT="${GRAFANA_PORT:-3001}"
PROM_RETENTION="${PROMETHEUS_RETENTION:-30d}"
PROM_CFG_DIR="/etc/prometheus"
PROM_DATA_DIR="/var/lib/prometheus"
PROM_PROXY_PREFIX="${PM_PROMETHEUS_PROXY_PREFIX:-/api/monitoring/embed/prometheus/}"
GRAF_PROXY_PREFIX="${PM_GRAFANA_PROXY_PREFIX:-/api/monitoring/embed/grafana/}"
PM_MON_DIR="${PM_MONITORING_DIR:-${PM_INSTALL_DIR}/monitoring}"
MONITORING_PUBLIC_BASE_URL="${PM_MONITORING_PUBLIC_BASE_URL:-}"
GRAFANA_INI_FILE="${GRAFANA_INI_FILE:-/etc/grafana/grafana.ini}"
GRAFANA_PROV_ROOT="${GRAFANA_PROV_ROOT:-/etc/grafana/provisioning}"
GRAFANA_DS_DIR="${GRAFANA_DS_DIR:-${GRAFANA_PROV_ROOT}/datasources}"
GRAFANA_DASH_DIR="${GRAFANA_DASH_DIR:-${GRAFANA_PROV_ROOT}/dashboards}"
GRAFANA_DASH_TARGET="${GRAFANA_DASH_TARGET:-/var/lib/grafana/dashboards}"
PATCHMASTER_GRAFANA_DS_FILE="${PATCHMASTER_GRAFANA_DS_FILE:-${GRAFANA_DS_DIR}/patchmaster-prometheus.yml}"

status_json() {
  local svc="$1"
  local port="$2"
  local installed="false"
  local running="false"
  local load_state=""
  load_state="$(systemctl show "$svc" -p LoadState --value 2>/dev/null || true)"
  if [ -n "$load_state" ] && [ "$load_state" != "not-found" ]; then
    installed="true"
  fi
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    running="true"
  fi
  echo "\"$svc\":{\"installed\":$installed,\"running\":$running,\"port\":$port}"
}

run_service_action() {
  local action="$1"
  local svc="$2"

  case "$action" in
    start)
      if [ "$svc" = "$GRAF_SERVICE" ]; then
        systemctl reset-failed "$svc" >/dev/null 2>&1 || true
      fi
      systemctl start "$svc" || true
      ;;
    stop)
      systemctl stop "$svc" || true
      if [ "$svc" = "$GRAF_SERVICE" ]; then
        # Grafana 12 can exit with status 1 on a clean SIGTERM; clear the failed
        # state so a subsequent start from PatchMaster succeeds.
        systemctl reset-failed "$svc" >/dev/null 2>&1 || true
      fi
      ;;
    restart)
      if [ "$svc" = "$GRAF_SERVICE" ]; then
        systemctl stop "$svc" >/dev/null 2>&1 || true
        systemctl reset-failed "$svc" >/dev/null 2>&1 || true
        systemctl start "$svc" || true
      else
        systemctl restart "$svc" || true
      fi
      ;;
  esac
}

set_ini_value() {
  local file="$1"
  local section="$2"
  local key="$3"
  local value="$4"
  python3 - "$file" "$section" "$key" "$value" <<'PY'
from pathlib import Path
import re
import sys

file_name, section, key, value = sys.argv[1:]
path = Path(file_name)
text = path.read_text(encoding="utf-8") if path.exists() else ""
lines = text.splitlines()
section_header = f"[{section}]"
key_re = re.compile(rf"^\s*[;#]?\s*{re.escape(key)}\s*=")
out = []
in_section = False
section_found = False
key_written = False

for line in lines:
    stripped = line.strip()
    if stripped.startswith("[") and stripped.endswith("]"):
        if in_section and not key_written:
            out.append(f"{key} = {value}")
            key_written = True
        in_section = stripped == section_header
        section_found = section_found or in_section
        out.append(line)
        continue
    if in_section and key_re.match(line):
        if not key_written:
            out.append(f"{key} = {value}")
            key_written = True
        continue
    out.append(line)

if not section_found:
    if out and out[-1] != "":
        out.append("")
    out.extend([section_header, f"{key} = {value}"])
elif in_section and not key_written:
    out.append(f"{key} = {value}")

path.write_text("\n".join(out) + "\n", encoding="utf-8")
PY
}

configure_prometheus_proxy() {
  local prom_bin
  prom_bin="$(command -v prometheus 2>/dev/null || echo /usr/local/bin/prometheus)"
  mkdir -p /etc/systemd/system/prometheus.service.d "$PROM_CFG_DIR" "$PROM_DATA_DIR"
  cat > /etc/systemd/system/prometheus.service.d/patchmaster-proxy.conf <<EOF
[Service]
ExecStart=
ExecStart=${prom_bin} \\
  --config.file=${PROM_CFG_DIR}/prometheus.yml \\
  --storage.tsdb.path=${PROM_DATA_DIR} \\
  --storage.tsdb.retention.time=${PROM_RETENTION} \\
  --web.listen-address=127.0.0.1:${PROM_PORT} \\
  --web.enable-lifecycle \\
  --web.external-url=${PROM_PROXY_PREFIX}
EOF
  systemctl daemon-reload
}

configure_grafana_proxy() {
  if [ ! -f "$GRAFANA_INI_FILE" ]; then
    return
  fi
  set_ini_value "$GRAFANA_INI_FILE" server http_port "${GRAF_PORT}"
  set_ini_value "$GRAFANA_INI_FILE" server http_addr "127.0.0.1"
  if [ -n "$MONITORING_PUBLIC_BASE_URL" ]; then
    set_ini_value "$GRAFANA_INI_FILE" server root_url "${MONITORING_PUBLIC_BASE_URL%/}${GRAF_PROXY_PREFIX}"
    set_ini_value "$GRAFANA_INI_FILE" server serve_from_sub_path "true"
  fi
  set_ini_value "$GRAFANA_INI_FILE" security allow_embedding "true"
  set_ini_value "$GRAFANA_INI_FILE" auth.anonymous enabled "true"
  set_ini_value "$GRAFANA_INI_FILE" auth.anonymous org_role "Viewer"
}

sync_prometheus_assets() {
  id prometheus >/dev/null 2>&1 || useradd --system --no-create-home --shell /bin/false prometheus
  mkdir -p "$PROM_CFG_DIR" "$PROM_DATA_DIR"
  chown prometheus:prometheus "$PROM_DATA_DIR"

  if [ -f "$PM_MON_DIR/prometheus/prometheus.yml" ]; then
    cp "$PM_MON_DIR/prometheus/prometheus.yml" "$PROM_CFG_DIR/prometheus.yml"
  elif [ ! -f "$PROM_CFG_DIR/prometheus.yml" ]; then
    mkdir -p "$PM_MON_DIR/prometheus/agents"
    cat > "$PROM_CFG_DIR/prometheus.yml" <<PROMCFG
global:
  scrape_interval: 15s
  evaluation_interval: 15s
scrape_configs:
  - job_name: 'patchmaster-backend'
    metrics_path: /metrics
    static_configs:
      - targets: ['localhost:8000']
        labels:
          instance: 'patchmaster-server'
  - job_name: 'patchmaster-agents'
    metrics_path: /metrics
    file_sd_configs:
      - files:
          - '$PM_MON_DIR/prometheus/agents/*.json'
        refresh_interval: 60s
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
PROMCFG
  fi

  if [ -f "$PM_MON_DIR/prometheus/alerts.yml" ]; then
    cp "$PM_MON_DIR/prometheus/alerts.yml" "$PROM_CFG_DIR/alerts.yml"
  elif [ ! -f "$PROM_CFG_DIR/alerts.yml" ]; then
    cat > "$PROM_CFG_DIR/alerts.yml" <<'ALERTS'
groups: []
ALERTS
  fi

  chown -R prometheus:prometheus "$PROM_CFG_DIR"
}

normalize_grafana_datasource_defaults() {
  local prov_ds_dir="${1:-$GRAFANA_DS_DIR}"
  local managed_file
  managed_file="$(basename "$PATCHMASTER_GRAFANA_DS_FILE")"

  mkdir -p "$prov_ds_dir"

  python3 - "$prov_ds_dir" "$managed_file" <<'PY'
from pathlib import Path
import re
import sys

prov_dir = Path(sys.argv[1])
managed_file = sys.argv[2]
default_re = re.compile(r"^(\s*isDefault\s*:\s*)true(\s*(?:#.*)?)$", re.IGNORECASE)

for path in sorted(prov_dir.glob("*.y*ml")):
    if path.name == managed_file:
        continue
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        continue
    updated = False
    new_lines = []
    for line in text.splitlines():
        match = default_re.match(line)
        if match:
            line = f"{match.group(1)}false{match.group(2)}"
            updated = True
        new_lines.append(line)
    if updated:
        path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
PY
}

provision_grafana_assets() {
  local prov_dash_dir="$GRAFANA_DASH_DIR"
  local prov_ds_dir="$GRAFANA_DS_DIR"
  local dash_target="$GRAFANA_DASH_TARGET"

  mkdir -p "$prov_dash_dir" "$prov_ds_dir" "$dash_target"

  cat > "$PATCHMASTER_GRAFANA_DS_FILE" <<DSCFG
apiVersion: 1
datasources:
  - uid: patchmaster-prometheus
    name: PatchMaster Prometheus
    type: prometheus
    access: proxy
    url: http://localhost:${PROMETHEUS_PORT:-9090}${PROM_PROXY_PREFIX%/}
    isDefault: true
    editable: true
DSCFG
  normalize_grafana_datasource_defaults "$prov_ds_dir"

  if [ -d "$PM_MON_DIR/grafana/dashboards" ]; then
    cp -rT "$PM_MON_DIR/grafana/dashboards" "$dash_target" 2>/dev/null || {
      rm -rf "$dash_target"
      mkdir -p "$dash_target"
      cp -r "$PM_MON_DIR/grafana/dashboards"/. "$dash_target"/
    }
    cat > "$prov_dash_dir/patchmaster.yml" <<'DASHCFG'
apiVersion: 1
providers:
  - name: PatchMaster
    type: file
    options:
      path: /var/lib/grafana/dashboards
DASHCFG
  fi

  if id grafana >/dev/null 2>&1; then
    chown -R grafana:grafana "$dash_target" "$prov_dash_dir" "$prov_ds_dir" 2>/dev/null || true
  fi
}

case "$ACTION" in
  status)
    echo -n "{"
    echo -n "$(status_json "$PROM_SERVICE" 9090)"
    echo -n ","
    echo -n "$(status_json "$GRAF_SERVICE" "${GRAFANA_PORT:-3001}")"
    echo "}"
    ;;
  start|stop|restart)
    for svc in $([ "$TARGET" = "all" ] && echo "$PROM_SERVICE $GRAF_SERVICE" || echo "$TARGET"); do
      # Map logical names to detected unit names
      if [ "$svc" = "prometheus" ]; then svc="$PROM_SERVICE"; fi
      if [ "$svc" = "grafana" ]; then svc="$GRAF_SERVICE"; fi
      run_service_action "$ACTION" "$svc"
    done
    echo "{\"ok\":true}"
    ;;
  install)
    # Install Prometheus and/or Grafana if not already present
    PROM_VER="${PROMETHEUS_VERSION:-2.51.2}"
    PROM_ARCH="linux-amd64"
    PROM_BIN="/usr/local/bin/prometheus"
    PROM_SVC="/etc/systemd/system/prometheus.service"

    if [[ "$TARGET" = "all" || "$TARGET" = "prometheus" || "$TARGET" = "$PROM_SERVICE" ]]; then
      if ! command -v prometheus >/dev/null 2>&1 && [ ! -f "$PROM_BIN" ]; then
        echo "Installing Prometheus ${PROM_VER}..." >&2
        TMP=$(mktemp -d)
        TARBALL="prometheus-${PROM_VER}.${PROM_ARCH}.tar.gz"
        URL="https://github.com/prometheus/prometheus/releases/download/v${PROM_VER}/${TARBALL}"
        if command -v curl >/dev/null 2>&1; then
          curl -fsSL "$URL" -o "$TMP/$TARBALL"
        else
          wget -q "$URL" -O "$TMP/$TARBALL"
        fi
        tar -xzf "$TMP/$TARBALL" -C "$TMP"
        PROM_DIR="$TMP/prometheus-${PROM_VER}.${PROM_ARCH}"
        install -m 755 "$PROM_DIR/prometheus" "$PROM_BIN"
        install -m 755 "$PROM_DIR/promtool" /usr/local/bin/promtool
        rm -rf "$TMP"

        sync_prometheus_assets

        # Write systemd unit
        cat > "$PROM_SVC" <<UNIT
[Unit]
Description=Prometheus Monitoring
After=network.target

[Service]
User=prometheus
Group=prometheus
Type=simple
ExecStart=${PROM_BIN} \\
  --config.file=${PROM_CFG_DIR}/prometheus.yml \\
  --storage.tsdb.path=${PROM_DATA_DIR} \\
  --storage.tsdb.retention.time=${PROM_RETENTION} \\
  --web.listen-address=127.0.0.1:${PROM_PORT} \\
  --web.enable-lifecycle \\
  --web.external-url=${PROM_PROXY_PREFIX}
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT
        systemctl daemon-reload
        systemctl enable prometheus.service || true
        echo "Prometheus installed." >&2
      else
        echo "Prometheus already installed." >&2
      fi
      sync_prometheus_assets
      configure_prometheus_proxy
    fi

    if [[ "$TARGET" = "all" || "$TARGET" = "grafana" || "$TARGET" = "$GRAF_SERVICE" ]]; then
      if ! command -v grafana-server >/dev/null 2>&1 && ! systemctl status grafana-server >/dev/null 2>&1; then
        echo "Installing Grafana..." >&2
        if command -v apt-get >/dev/null 2>&1; then
          apt-get install -y -q apt-transport-https software-properties-common wget gnupg2 >/dev/null 2>&1 || true
          mkdir -p /etc/apt/keyrings
          wget -q -O /etc/apt/keyrings/grafana.gpg https://apt.grafana.com/gpg.key 2>/dev/null || \
            curl -fsSL https://apt.grafana.com/gpg.key | gpg --dearmor -o /etc/apt/keyrings/grafana.gpg
          echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" \
            > /etc/apt/sources.list.d/grafana.list
          apt-get update -qq >/dev/null 2>&1
          apt-get install -y -q grafana >/dev/null 2>&1
        elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
          PKG="${PKG_MGR:-dnf}"
          cat > /etc/yum.repos.d/grafana.repo <<'REPO'
[grafana]
name=grafana
baseurl=https://rpm.grafana.com
repo_gpgcheck=1
enabled=1
gpgcheck=1
gpgkey=https://rpm.grafana.com/gpg.key
sslverify=1
sslcacert=/etc/pki/tls/certs/ca-bundle.crt
REPO
          $PKG install -y grafana >/dev/null 2>&1
        fi

        # Set Grafana port
        configure_grafana_proxy

        provision_grafana_assets

        systemctl daemon-reload
        systemctl enable grafana-server.service || true
        echo "Grafana installed." >&2
      else
        echo "Grafana already installed." >&2
      fi
      provision_grafana_assets
      configure_grafana_proxy
    fi

    echo "{\"ok\":true}"
    ;;
  enforce)
    flag="${2:-0}"
    if [ "$flag" = "1" ]; then
      configure_prometheus_proxy
      configure_grafana_proxy
      run_service_action start "$PROM_SERVICE"
      run_service_action start "$GRAF_SERVICE"
    else
      run_service_action stop "$PROM_SERVICE"
      run_service_action stop "$GRAF_SERVICE"
    fi
    echo "{\"ok\":true}"
    ;;
  reload-dashboards)
    # provisioning-based reload: touching provisioning dir triggers Grafana to rescan
    PROV_DIR="${PM_MONITORING_DIR:-/opt/patchmaster/monitoring}/grafana/provisioning/dashboards"
    mkdir -p "$PROV_DIR"
    touch "$PROV_DIR/.reload"
    run_service_action restart "$GRAF_SERVICE"
    echo "{\"ok\":true}"
    ;;
  *)
    echo "{\"ok\":false,\"error\":\"unknown action\"}"
    exit 1
    ;;
esac
