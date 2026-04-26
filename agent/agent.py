#!/usr/bin/env python3
"""PatchMaster by YVGROUP Agent - Full patch management with snapshot/rollback, offline install, package comparison."""

import argparse
import logging
import os
import shutil
import subprocess
import time
import json
import glob
import re
import stat
import uuid
from datetime import datetime, timezone
import platform
from logging.handlers import RotatingFileHandler
import yaml
import urllib.request
import urllib.error
import tempfile
import threading
import zipfile
import tarfile
import psutil
import functools
import hmac as _hmac
import gc
import sys
from pathlib import Path

# Flask imports are optional - only needed when running the agent API server
# This allows package manager classes to be imported in tests without Flask
try:
    from flask import Flask, jsonify, request, send_file
    from werkzeug.utils import secure_filename

    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    Flask = None
    jsonify = None
    request = None
    send_file = None
    secure_filename = None

from prometheus_client import start_http_server, Gauge, CollectorRegistry

__version__ = "2.0.0"

# Import new platform managers (Solaris, HP-UX, AIX)
try:
    from agent.solaris_manager import SolarisManager
except ImportError:
    SolarisManager = None

try:
    from agent.hpux_manager import HPUXManager
except ImportError:
    HPUXManager = None

try:
    from agent.aix_manager import AIXManager
except ImportError:
    AIXManager = None

# --- Config ---
IS_WINDOWS = platform.system() == "Windows"

# ── Agent API token auth ──────────────────────────────────────────────────────
# The agent accepts two valid tokens (either is sufficient):
#   1. AGENT_API_TOKEN env var — a shared/override token set by the operator.
#   2. The per-host registration token written to STATE_DIR/token by main.py
#      after the agent registers with the backend.  The backend stores the same
#      value in hosts.agent_token, so it can look it up per-host and send it.
#
# If neither token is configured yet, privileged endpoints stay unavailable until
# the heartbeat service registers and persists the per-host token.


def _load_valid_tokens() -> set:
    """Return the set of currently valid bearer tokens."""
    tokens = set()
    env_tok = os.environ.get("AGENT_API_TOKEN", "").strip()
    if env_tok:
        tokens.add(env_tok)
    # Per-host registration token written by main.py
    _state_dir = os.environ.get("PATCHMASTER_AGENT_STATE") or (
        r"C:\ProgramData\PatchMaster-Agent" if IS_WINDOWS else "/var/lib/patch-agent"
    )
    _token_path = os.path.join(_state_dir, "token")
    try:
        if os.path.isfile(_token_path):
            reg_tok = open(_token_path).read().strip()
            if reg_tok:
                tokens.add(reg_tok)
    except OSError:
        pass
    return tokens


def run_cmd(cmd, timeout=3600, cwd=None):
    """Execute a shell command and return (returncode, output)."""
    # Use a dummy logger if not yet initialized
    log = globals().get('logger')
    if log:
        log.info("CMD: %s", " ".join(str(c) for c in cmd) if isinstance(cmd, list) else cmd)
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=timeout,
            cwd=cwd,
        )
        return proc.returncode, proc.stdout
    except subprocess.TimeoutExpired:
        return -1, "Command timed out"
    except Exception as e:
        return -1, str(e)


def _require_auth(fn):
    """Decorator: enforce bearer-token auth when any token is configured."""
    if not FLASK_AVAILABLE:
        # If Flask is not available, return the function as-is (for testing)
        return fn

    @functools.wraps(fn)
    def _wrapper(*args, **kwargs):
        valid_tokens = _load_valid_tokens()
        if not valid_tokens:
            return jsonify({"error": "agent auth token not initialized"}), 503
        auth_header = request.headers.get("Authorization", "")
        if auth_header.lower().startswith("bearer "):
            provided = auth_header.split(" ", 1)[1].strip()
        else:
            provided = ""
        # Constant-time comparison against each valid token
        if not provided or not any(
            _hmac.compare_digest(provided, t) for t in valid_tokens
        ):
            return jsonify({"error": "unauthorized"}), 401
        return fn(*args, **kwargs)

    return _wrapper


def _real_norm(path: str) -> str:
    return os.path.normcase(os.path.realpath(path))


def _is_within_dir(path: str, root: str) -> bool:
    root_real = _real_norm(root)
    path_real = _real_norm(path)
    return path_real == root_real or path_real.startswith(root_real + os.sep)


def _safe_extract_zip(zip_obj: zipfile.ZipFile, dest: str) -> None:
    dest_real = _real_norm(dest)
    for member in zip_obj.infolist():
        member_name = member.filename
        if os.path.isabs(member_name):
            raise ValueError(f"Archive member uses absolute path: {member_name}")
        mode = member.external_attr >> 16
        if stat.S_ISLNK(mode):
            raise ValueError(f"Archive member is a symlink: {member_name}")
        out_path = _real_norm(os.path.join(dest, member_name))
        if not (out_path == dest_real or out_path.startswith(dest_real + os.sep)):
            raise ValueError(f"Archive member escapes target directory: {member_name}")
    zip_obj.extractall(dest)


def _safe_extract_tar(tar_obj: tarfile.TarFile, dest: str) -> None:
    dest_real = _real_norm(dest)
    for member in tar_obj.getmembers():
        member_name = member.name
        if os.path.isabs(member_name):
            raise ValueError(f"Archive member uses absolute path: {member_name}")
        if member.issym() or member.islnk():
            raise ValueError(f"Archive member is a link: {member_name}")
        out_path = _real_norm(os.path.join(dest, member_name))
        if not (out_path == dest_real or out_path.startswith(dest_real + os.sep)):
            raise ValueError(f"Archive member escapes target directory: {member_name}")
    tar_obj.extractall(dest)


def _agent_callback_token() -> str:
    state_dir = os.environ.get("PATCHMASTER_AGENT_STATE") or (
        r"C:\ProgramData\PatchMaster-Agent" if IS_WINDOWS else "/var/lib/patch-agent"
    )
    token_path = os.path.join(state_dir, "token")
    try:
        if os.path.isfile(token_path):
            token = open(token_path).read().strip()
            if token:
                return token
    except OSError:
        pass
    return os.environ.get("AGENT_API_TOKEN", "").strip()


def _controller_url() -> str:
    return str(os.environ.get("CONTROLLER_URL", "") or "").strip().rstrip("/")


def _path_size_bytes(path: str) -> int:
    if not path or not os.path.exists(path):
        return 0
    if os.path.isfile(path):
        return int(os.path.getsize(path))
    total = 0
    for root, _, files in os.walk(path):
        for name in files:
            try:
                total += os.path.getsize(os.path.join(root, name))
            except OSError:
                pass
    return int(total)


def _report_backup_result(
    log_id, status, output_file="", duration_seconds=0.0, file_size_bytes=0, message=""
):
    controller_url = _controller_url()
    token = _agent_callback_token()
    if not controller_url or not token or not log_id:
        return
    body = json.dumps(
        {
            "log_id": int(log_id),
            "status": str(status or ""),
            "output_file": str(output_file or ""),
            "file_size_bytes": int(file_size_bytes or 0),
            "duration_seconds": float(duration_seconds or 0.0),
            "message": str(message or ""),
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{controller_url}/api/backups/agent-callback",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp.read()
    except Exception as exc:
        logger.error(f"Backup callback failed for log {log_id}: {exc}")


# --- Metrics ---
# Use a dedicated registry to avoid duplicate timeseries errors when the module is
# imported multiple times (e.g., by Windows services restarting quickly).
REGISTRY = CollectorRegistry()
cpu_usage = Gauge(
    "system_cpu_usage_percent", "System CPU usage percent", registry=REGISTRY
)
memory_usage = Gauge(
    "system_memory_usage_percent", "System memory usage percent", registry=REGISTRY
)
disk_usage = Gauge(
    "system_disk_usage_percent",
    "System disk usage percent",
    ["mountpoint"],
    registry=REGISTRY,
)
disk_read_bps = Gauge(
    "system_disk_read_bytes_per_sec",
    "System disk read throughput bytes/sec",
    registry=REGISTRY,
)
disk_write_bps = Gauge(
    "system_disk_write_bytes_per_sec",
    "System disk write throughput bytes/sec",
    registry=REGISTRY,
)
uptime_seconds = Gauge(
    "system_uptime_seconds", "System uptime in seconds", registry=REGISTRY
)
host_info = Gauge(
    "patchmaster_host_info",
    "Static host metadata (1=present)",
    ["host_os"],
    registry=REGISTRY,
)
patch_gauge = Gauge(
    "patch_job_status",
    "Current patch job status (0=idle, 1=running, 2=success, 3=failed)",
    registry=REGISTRY,
)
last_patch_ts = Gauge(
    "patch_last_success_timestamp",
    "Timestamp of last successful patch",
    registry=REGISTRY,
)

# Memory leak detection - tracked in update_metrics_loop
_memory_baseline_bytes = 0
_memory_baseline_set_time = 0
_memory_warnings_logged = {"100mb": False, "200mb": False}

logger = logging.getLogger("patch-agent")
agent_memory_delta = Gauge(
    "agent_memory_delta_bytes",
    "Agent memory delta from baseline in bytes",
    registry=REGISTRY,
)

# Cache for WSUS operations (Windows only). Helps report scan/install progress to the backend/UI.
WSUS_CACHE = {
    "status": "idle",  # idle | scanning | installing | error
    "pending": [],
    "last_scan": None,
    "last_error": None,
}


def _host_os_label() -> str:
    system = (platform.system() or "").strip().lower()
    if "win" in system:
        return "windows"
    if system == "linux":
        return "linux"
    return system or "unknown"


def update_metrics_loop():
    global _memory_baseline_bytes, _memory_baseline_set_time
    prev_read = None
    prev_write = None
    prev_ts = None

    while True:
        try:
            cpu_usage.set(psutil.cpu_percent(interval=None))
            memory_usage.set(psutil.virtual_memory().percent)
            host_info.labels(host_os=_host_os_label()).set(1)
            io_now = psutil.disk_io_counters()
            now_ts = time.time()

            # Memory leak detection - set baseline on first run, monitor growth
            process = psutil.Process()
            current_rss = process.memory_info().rss
            if _memory_baseline_bytes == 0:
                _memory_baseline_bytes = current_rss
                _memory_baseline_set_time = now_ts
                logger.info(
                    f"Memory baseline set: {_memory_baseline_bytes / (1024 * 1024):.1f} MB"
                )
            else:
                memory_growth = current_rss - _memory_baseline_bytes
                agent_memory_delta.set(max(0, memory_growth))
                # Log warning if memory grows >100MB above baseline after 30 minutes
                uptime_mins = (now_ts - _memory_baseline_set_time) / 60
                if uptime_mins >= 30 and memory_growth > 100 * 1024 * 1024:
                    if not _memory_warnings_logged["100mb"]:
                        logger.warning(
                            f"Memory leak indicator: memory grew {memory_growth / (1024 * 1024):.1f} MB "
                            f"({uptime_mins:.0f} minutes after baseline)"
                        )
                        _memory_warnings_logged["100mb"] = True
                # Log error if memory grows >200MB above baseline
                if memory_growth > 200 * 1024 * 1024:
                    if not _memory_warnings_logged["200mb"]:
                        logger.error(
                            f"Memory leak detected: memory grew {memory_growth / (1024 * 1024):.1f} MB "
                            f"({uptime_mins:.0f} minutes after baseline)"
                        )
                        _memory_warnings_logged["200mb"] = True

            if (
                io_now
                and prev_read is not None
                and prev_write is not None
                and prev_ts is not None
            ):
                dt = max(now_ts - prev_ts, 0.001)
                disk_read_bps.set(max((io_now.read_bytes - prev_read) / dt, 0.0))
                disk_write_bps.set(max((io_now.write_bytes - prev_write) / dt, 0.0))
            if io_now:
                prev_read = io_now.read_bytes
                prev_write = io_now.write_bytes
                prev_ts = now_ts
            for part in psutil.disk_partitions(all=False):
                if IS_WINDOWS or part.mountpoint == "/":
                    try:
                        usage = psutil.disk_usage(part.mountpoint).percent
                        disk_usage.labels(mountpoint=part.mountpoint).set(usage)
                    except (OSError, PermissionError):
                        # Disk may be unmounted or inaccessible
                        pass
            uptime_seconds.set(time.time() - psutil.boot_time())
        except Exception as e:
            logger.error(f"Metrics error: {e}")
        time.sleep(15)


threading.Thread(target=update_metrics_loop, daemon=True).start()

# Prefer ProgramData\PatchMaster-Agent for Windows to align with service logs.
LOG_DIR = (
    r"C:\ProgramData\PatchMaster-Agent\logs" if IS_WINDOWS else "/var/log/patch-agent"
)
SNAPSHOT_DIR = (
    r"C:\ProgramData\PatchMaster-Agent\snapshots"
    if IS_WINDOWS
    else "/var/lib/patch-agent/snapshots"
)
OFFLINE_DIR = (
    r"C:\ProgramData\PatchMaster-Agent\offline-pkgs"
    if IS_WINDOWS
    else "/var/lib/patch-agent/offline-pkgs"
)

for d in [LOG_DIR, SNAPSHOT_DIR, OFFLINE_DIR]:
    try:
        os.makedirs(d, exist_ok=True)
    except PermissionError:
        # Fallback for dev/non-root
        if IS_WINDOWS:
            LOG_DIR = r".\logs"
            SNAPSHOT_DIR = r".\snapshots"
            OFFLINE_DIR = r".\offline-pkgs"
        else:
            LOG_DIR = "./logs"
            SNAPSHOT_DIR = "./snapshots"
            OFFLINE_DIR = "./offline-pkgs"
        os.makedirs(LOG_DIR, exist_ok=True)
        os.makedirs(SNAPSHOT_DIR, exist_ok=True)
        os.makedirs(OFFLINE_DIR, exist_ok=True)

STATE_DIR = os.path.dirname(SNAPSHOT_DIR) or "."
SHUTDOWN_QUEUE_FILE = os.path.join(STATE_DIR, "software-shutdown-queue.json")
QUEUE_LOCK = threading.Lock()

logger.setLevel(logging.INFO)

# Set up formatter
fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")

# Try to set up file logging, fall back to console-only if permission denied (e.g., during tests)
log_file = os.path.join(LOG_DIR, "agent.log")
try:
    fh = RotatingFileHandler(log_file, maxBytes=5 * 1024 * 1024, backupCount=5)
    fh.setFormatter(fmt)
    logger.addHandler(fh)
except (PermissionError, OSError) as e:
    # Running without admin privileges (e.g., in tests) - use console logging only
    pass

console = logging.StreamHandler()
console.setFormatter(fmt)
logger.addHandler(console)

# Flask app initialization - only when Flask is available
if FLASK_AVAILABLE:
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = None  # No limit - handle uploads of any size
else:
    app = None

    # Create a dummy app object with a route decorator that does nothing
    class _DummyApp:
        def route(self, *args, **kwargs):
            def decorator(f):
                return f

            return decorator

    app = _DummyApp()

# --- Package Manager Abstraction ---


class BasePackageManager:
    def list_installed(self):
        raise NotImplementedError()

    def list_upgradable(self):
        raise NotImplementedError()

    def refresh(self):
        raise NotImplementedError()

    def install(
        self,
        packages,
        local=False,
        security_only=False,
        exclude_kernel=False,
        extra_flags=None,
    ):
        raise NotImplementedError()

    def remove(self, packages):
        raise NotImplementedError()

    def _filter_security_packages(self, packages):
        """
        Query backend to filter packages to only those with CVEs.
        Used on platforms without native security classification.

        Args:
            packages: List of package dicts with 'name' key or list of strings

        Returns:
            List of package names that have security vulnerabilities
        """
        try:
            import requests
            import logging

            # Get controller URL and token from environment
            controller_url = os.getenv("CONTROLLER_URL", "http://localhost:3000")
            token = os.getenv("AGENT_TOKEN", "")

            # Get host ID from local cache
            host_id = self._get_host_id()
            if not host_id:
                logging.warning("No host_id found, cannot filter security packages")
                # Fallback: return all packages
                return [
                    p if isinstance(p, str) else p.get("name", "") for p in packages
                ]

            # Extract package names
            pkg_names = []
            for p in packages:
                if isinstance(p, str):
                    pkg_names.append(p)
                elif isinstance(p, dict):
                    pkg_names.append(p.get("name", ""))

            pkg_names = [n for n in pkg_names if n]

            if not pkg_names:
                return []

            # Query backend CVE filter API
            response = requests.post(
                f"{controller_url}/api/cve/filter-security",
                json={
                    "host_id": host_id,
                    "packages": pkg_names,
                    "severity_threshold": "medium",
                },
                headers={"Authorization": f"Bearer {token}"},
                timeout=30,
            )

            if response.status_code == 200:
                data = response.json()
                security_pkgs = data.get("security_packages", [])
                logging.info(
                    f"CVE filter: {len(security_pkgs)}/{len(pkg_names)} packages have security issues"
                )
                return security_pkgs
            else:
                # Fallback: install all packages if backend query fails
                logging.warning(
                    f"CVE filter failed with status {response.status_code}, installing all packages"
                )
                return pkg_names

        except Exception as e:
            # Fallback: install all packages if query fails
            logging.warning(f"CVE filter error: {e}, installing all packages")
            return [p if isinstance(p, str) else p.get("name", "") for p in packages]

    def _get_host_id(self):
        """Get host ID from local cache or registration"""
        try:
            # Try multiple locations
            for path in [
                "/var/lib/patch-agent/host_id",
                "/etc/patch-agent/host_id",
                "host_id",
            ]:
                if os.path.exists(path):
                    with open(path, "r") as f:
                        return f.read().strip()
        except Exception:
            pass
        return None


class AptManager(BasePackageManager):
    def list_installed(self):
        rc, out = run_cmd(
            ["dpkg-query", "-W", "-f", "${Package}\t${Version}\t${Status}\n"],
            timeout=30,
        )
        if rc != 0:
            return []
        packages = []
        for line in out.strip().splitlines():
            parts = line.split("\t")
            if len(parts) >= 3 and "installed" in parts[2].lower():
                packages.append(
                    {"name": parts[0], "version": parts[1], "status": parts[2].strip()}
                )
        return packages

    def list_upgradable(self):
        rc, out = run_cmd(["apt", "list", "--upgradable"], timeout=30)
        if rc != 0:
            return []
        packages = []
        for line in out.strip().splitlines():
            if (
                not line.strip()
                or line.startswith("Listing")
                or line.startswith("WARNING")
                or "/" not in line
            ):
                continue
            try:
                name_src = line.split("/")[0].strip()
                rest = line.split(" ")
                candidate = rest[1] if len(rest) > 1 else ""
                current = ""
                if "[upgradable from:" in line:
                    current = line.split("[upgradable from:")[1].strip(" ]")
                packages.append(
                    {
                        "name": name_src,
                        "current_version": current,
                        "available_version": candidate,
                    }
                )
            except (IndexError, ValueError):
                continue
        return packages

    def refresh(self):
        return run_cmd(["apt-get", "update", "-qq"], timeout=120)

    def install(
        self,
        packages,
        local=False,
        security_only=False,
        exclude_kernel=False,
        extra_flags=None,
    ):
        if local:
            # Use apt-get instead of dpkg for better dependency handling
            # apt-get can install local .deb files and resolve dependencies
            return run_cmd(
                ["apt-get", "install", "-y", "-qq", "--allow-downgrades"] + packages,
                timeout=600,
            )
        if security_only and not packages:
            cmd = [
                "apt-get",
                "upgrade",
                "-y",
                "-qq",
                "-o",
                "Dir::Etc::SourceList=/etc/apt/sources.list.d/security.list",
                "-o",
                "Dir::Etc::SourceParts=/dev/null",
            ]
        elif not packages:
            cmd = ["apt-get", "upgrade", "-y", "-qq"]
        else:
            cmd = ["apt-get", "install", "-y", "-qq"]
        if exclude_kernel:
            cmd += [
                "--exclude=linux-image*",
                "--exclude=linux-headers*",
                "--exclude=linux-modules*",
            ]
        if extra_flags:
            cmd += [f for f in extra_flags if isinstance(f, str)]
        return run_cmd(cmd + packages, timeout=600)

    def remove(self, packages):
        return run_cmd(["apt-get", "remove", "-y", "-qq"] + packages, timeout=600)

    def check_reboot(self):
        return os.path.exists("/var/run/reboot-required")


class DnfManager(BasePackageManager):
    def __init__(self):
        # Detect whether to use dnf or yum (Amazon Linux 2 uses yum, AL2023+ uses dnf)
        self.cmd = "dnf" if os.path.exists("/usr/bin/dnf") else "yum"

    def list_installed(self):
        rc, out = run_cmd(
            [
                "rpm",
                "-qa",
                "--queryformat",
                "%{NAME}\t%{VERSION}-%{RELEASE}\tinstalled\n",
            ],
            timeout=30,
        )
        if rc != 0:
            return []
        packages = []
        for line in out.strip().splitlines():
            parts = line.split("\t")
            if len(parts) >= 3:
                packages.append(
                    {"name": parts[0], "version": parts[1], "status": parts[2]}
                )
        return packages

    def list_upgradable(self):
        rc, out = run_cmd([self.cmd, "check-update", "--quiet"], timeout=60)
        # dnf/yum check-update returns 100 if updates are available
        if rc not in [0, 100]:
            return []
        packages = []
        for line in out.strip().splitlines():
            parts = line.split()
            if len(parts) >= 3 and "." in parts[0]:
                name = parts[0].rsplit(".", 1)[0]
                packages.append(
                    {
                        "name": name,
                        "current_version": "unknown",
                        "available_version": parts[1],
                    }
                )
        return packages

    def refresh(self):
        return run_cmd([self.cmd, "makecache"], timeout=120)

    def install(
        self,
        packages,
        local=False,
        security_only=False,
        exclude_kernel=False,
        extra_flags=None,
    ):
        if local:
            # Use localinstall for both yum and dnf
            return run_cmd([self.cmd, "localinstall", "-y"] + packages, timeout=600)
        if security_only and not packages:
            cmd = [self.cmd, "upgrade", "-y", "--security"]
        elif not packages:
            cmd = [self.cmd, "upgrade", "-y"]
        else:
            cmd = [self.cmd, "install", "-y"]
        if exclude_kernel:
            cmd += ["--exclude=kernel*"]
        if extra_flags:
            cmd += [f for f in extra_flags if isinstance(f, str)]
        return run_cmd(cmd + packages, timeout=600)

    def remove(self, packages):
        return run_cmd([self.cmd, "remove", "-y"] + packages, timeout=600)

    def check_reboot(self):
        # Check if reboot is required (works for both yum and dnf)
        if self.cmd == "dnf":
            # dnf needs-restarting -r returns 1 if reboot needed
            rc, _ = run_cmd(["dnf", "needs-restarting", "-r"], timeout=30)
            return rc == 1
        else:
            # For yum (Amazon Linux 2), check if kernel was updated
            rc, out = run_cmd(["rpm", "-q", "--last", "kernel"], timeout=30)
            if rc == 0:
                lines = out.strip().splitlines()
                if len(lines) > 1:
                    # Multiple kernels installed, likely needs reboot
                    return True
            # Also check for /var/run/reboot-required (some systems create this)
            return os.path.exists("/var/run/reboot-required")


class WinManager(BasePackageManager):
    def list_installed(self):
        # Using PowerShell to list installed applications (WMI/Get-Package)
        ps_cmd = "Get-Package | Select-Object Name, Version | ConvertTo-Json"
        rc, out = run_cmd(["powershell", "-Command", ps_cmd], timeout=60)
        if rc != 0:
            return []
        try:
            data = json.loads(out)
            if isinstance(data, dict):
                data = [data]
            return [
                {"name": d["Name"], "version": d["Version"], "status": "installed"}
                for d in data
            ]
        except (json.JSONDecodeError, KeyError, TypeError):
            return []

    def list_upgradable(self):
        rc, out = run_cmd(["winget", "upgrade"], timeout=60)
        if rc != 0:
            return []
        packages = []
        lines = out.strip().splitlines()
        # Find the header line to determine column positions
        header_idx = next(
            (i for i, l in enumerate(lines) if "Id" in l and "Version" in l), -1
        )
        if header_idx < 0:
            return packages
        for line in lines[header_idx + 2 :]:  # skip header + separator
            line = line.rstrip()
            if not line or line.startswith("-"):
                continue
            parts = re.split(r"\s{2,}", line.strip())
            if len(parts) >= 4:
                packages.append(
                    {
                        "name": parts[0],
                        "id": parts[1] if len(parts) > 1 else "",
                        "current_version": parts[2] if len(parts) > 2 else "",
                        "available_version": parts[3] if len(parts) > 3 else "",
                    }
                )
        return packages

    def refresh(self):
        return run_cmd(["winget", "source", "update"], timeout=60)

    def install(
        self,
        packages,
        local=False,
        security_only=False,
        exclude_kernel=False,
        extra_flags=None,
    ):
        results = []
        last_rc, last_out = 0, ""
        for pkg in packages:
            if pkg.endswith(".msi"):
                rc, out = run_cmd(
                    ["msiexec", "/i", pkg, "/quiet", "/norestart"], timeout=600
                )
            elif pkg.endswith(".exe"):
                rc, out = run_cmd([pkg, "/S"], timeout=600)
            else:
                rc, out = run_cmd(
                    [
                        "winget",
                        "install",
                        "--id",
                        pkg,
                        "--silent",
                        "--accept-package-agreements",
                        "--accept-source-agreements",
                    ],
                    timeout=600,
                )
            results.append((rc, out))
            if rc != 0:
                last_rc, last_out = rc, out
        # Return first failure if any, otherwise last success
        failed = [(rc, out) for rc, out in results if rc != 0]
        if failed:
            return failed[0]
        return results[-1] if results else (0, "")

    def remove(self, packages):
        results = []
        for pkg in packages:
            rc, out = run_cmd(
                ["winget", "uninstall", "--id", pkg, "--silent"], timeout=600
            )
            results.append((rc, out))
        failed = [(rc, out) for rc, out in results if rc != 0]
        if failed:
            return failed[0]
        return results[-1] if results else (0, "")

    def check_reboot(self):
        # Check registry for pending reboot
        ps_cmd = """
        $r1 = Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired';
        $r2 = Test-Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\PendingFileRenameOperations';
        if ($r1 -or $r2) { exit 1 } else { exit 0 }
        """
        rc, _ = run_cmd(["powershell", "-Command", ps_cmd], timeout=30)
        return rc == 1


class PacmanManager(BasePackageManager):
    """Package manager for Arch Linux using pacman with AUR support via yay"""

    def __init__(self):
        """Initialize and check for AUR helper availability"""
        self.aur_helper = self._detect_aur_helper()

    def _detect_aur_helper(self):
        """Detect which AUR helper is available (yay, paru, or none)"""
        # Check for yay (most popular)
        rc, _ = run_cmd(["which", "yay"], timeout=5)
        if rc == 0:
            return "yay"

        # Check for paru (alternative)
        rc, _ = run_cmd(["which", "paru"], timeout=5)
        if rc == 0:
            return "paru"

        # No AUR helper found
        return None

    def _is_aur_package(self, package):
        """Check if a package is from AUR"""
        if not self.aur_helper:
            return False

        # Check if package exists in official repos
        rc, _ = run_cmd(["pacman", "-Si", package], timeout=5)
        if rc == 0:
            return False  # Package is in official repos

        # Check if package exists in AUR
        if self.aur_helper == "yay":
            rc, _ = run_cmd(["yay", "-Si", package], timeout=10)
        elif self.aur_helper == "paru":
            rc, _ = run_cmd(["paru", "-Si", package], timeout=10)
        else:
            return False

        return rc == 0  # Package found in AUR

    def list_installed(self):
        """List all installed packages (including AUR packages)"""
        rc, out = run_cmd(["pacman", "-Q"], timeout=30)
        if rc != 0:
            return []

        result = []
        for line in out.strip().split("\n"):
            if not line.strip():
                continue
            parts = line.split()
            if len(parts) >= 2:
                pkg_name = parts[0]
                pkg_version = parts[1]

                # Check if it's an AUR package
                is_aur = False
                if self.aur_helper:
                    rc_check, _ = run_cmd(["pacman", "-Qi", pkg_name], timeout=5)
                    if rc_check == 0:
                        # Check the repository field
                        rc_repo, repo_out = run_cmd(
                            ["pacman", "-Qi", pkg_name], timeout=5
                        )
                        if rc_repo == 0 and "Repository" in repo_out:
                            # If repository is "None" or not found, it's likely AUR
                            for repo_line in repo_out.split("\n"):
                                if repo_line.startswith("Repository"):
                                    if (
                                        "None" in repo_line
                                        or "local" in repo_line.lower()
                                    ):
                                        is_aur = True
                                    break

                result.append(
                    {
                        "name": pkg_name,
                        "version": pkg_version,
                        "status": "installed",
                        "source": "aur" if is_aur else "official",
                    }
                )
        return result

    def list_upgradable(self):
        """List packages with available updates (including AUR packages)"""
        result = []

        # First sync databases
        run_cmd(["pacman", "-Sy"], timeout=60)

        # Get official repo updates
        rc, out = run_cmd(["pacman", "-Qu"], timeout=30)
        if rc == 0:
            for line in out.strip().split("\n"):
                if not line.strip():
                    continue
                # Format: package_name old_version -> new_version
                parts = line.split()
                if len(parts) >= 4 and parts[2] == "->":
                    pkg_name = parts[0]
                    old_version = parts[1]
                    new_version = parts[3]
                    result.append(
                        {
                            "name": pkg_name,
                            "current_version": old_version,
                            "candidate_version": new_version,
                            "source": "official",
                        }
                    )

        # Get AUR updates if helper is available
        if self.aur_helper:
            if self.aur_helper == "yay":
                rc, out = run_cmd(["yay", "-Qua"], timeout=60)
            elif self.aur_helper == "paru":
                rc, out = run_cmd(["paru", "-Qua"], timeout=60)
            else:
                rc = 1

            if rc == 0:
                for line in out.strip().split("\n"):
                    if not line.strip():
                        continue
                    parts = line.split()
                    if len(parts) >= 4 and parts[2] == "->":
                        pkg_name = parts[0]
                        old_version = parts[1]
                        new_version = parts[3]
                        result.append(
                            {
                                "name": pkg_name,
                                "current_version": old_version,
                                "candidate_version": new_version,
                                "source": "aur",
                            }
                        )

        return result

    def refresh(self):
        """Sync package databases (including AUR if helper available)"""
        # Sync official repos
        rc, out = run_cmd(["pacman", "-Sy"], timeout=120)

        # Sync AUR database if helper available
        if self.aur_helper:
            if self.aur_helper == "yay":
                run_cmd(["yay", "-Sy"], timeout=120)
            elif self.aur_helper == "paru":
                run_cmd(["paru", "-Sy"], timeout=120)

        return rc == 0

    def install(
        self,
        packages,
        local=False,
        security_only=False,
        exclude_kernel=False,
        extra_flags=None,
    ):
        """Install packages (supports both official repos and AUR)"""

        # NEW: Security-only filtering via backend CVE database
        if security_only and not local and not packages:
            # Get all upgradable packages
            upgradable = self.list_upgradable()
            if not upgradable:
                return 0, "No upgradable packages"

            # Query backend for security packages
            security_pkgs = self._filter_security_packages(upgradable)
            if not security_pkgs:
                return 0, "No security updates available"

            packages = security_pkgs

        if not packages:
            return 0, "No packages specified"

        # Filter kernel packages if requested
        if exclude_kernel:
            packages = [p for p in packages if not p.startswith("linux")]

        if not packages:
            return 0, "All packages filtered out"

        # Separate AUR and official packages
        aur_packages = []
        official_packages = []

        if not local and self.aur_helper:
            for pkg in packages:
                if self._is_aur_package(pkg):
                    aur_packages.append(pkg)
                else:
                    official_packages.append(pkg)
        else:
            official_packages = packages

        results = []

        # Install official packages with pacman
        if official_packages:
            if local:
                cmd = ["pacman", "-U", "--noconfirm"]
            else:
                cmd = ["pacman", "-S", "--noconfirm"]

            if extra_flags:
                cmd.extend(extra_flags)

            cmd.extend(official_packages)
            rc, out = run_cmd(cmd, timeout=3600)
            results.append((rc, out))

        # Install AUR packages with helper
        if aur_packages and self.aur_helper:
            if self.aur_helper == "yay":
                cmd = ["yay", "-S", "--noconfirm"]
            elif self.aur_helper == "paru":
                cmd = ["paru", "-S", "--noconfirm"]

            if extra_flags:
                cmd.extend(extra_flags)

            cmd.extend(aur_packages)
            rc, out = run_cmd(cmd, timeout=3600)
            results.append((rc, out))

        # Return combined results
        if not results:
            return 0, "No packages to install"

        # If any installation failed, return the first failure
        for rc, out in results:
            if rc != 0:
                return rc, out

        # All succeeded
        return results[-1] if results else (0, "Success")

    def remove(self, packages):
        """Remove packages (works for both official and AUR packages)"""
        if not packages:
            return 0, "No packages specified"

        # pacman can remove both official and AUR packages
        cmd = ["pacman", "-R", "--noconfirm"] + packages
        rc, out = run_cmd(cmd, timeout=600)
        return rc, out

    def check_reboot(self):
        """Check if system reboot is required"""
        # Check if kernel or systemd was updated
        # Compare running kernel with installed kernel

        # Get running kernel version
        rc, running_kernel = run_cmd(["uname", "-r"], timeout=5)
        if rc != 0:
            return False

        running_kernel = running_kernel.strip()

        # Get installed kernel version
        rc, out = run_cmd(["pacman", "-Q", "linux"], timeout=5)
        if rc != 0:
            # Try linux-lts
            rc, out = run_cmd(["pacman", "-Q", "linux-lts"], timeout=5)

        if rc == 0:
            # Parse version from "linux X.Y.Z-arch1-1"
            parts = out.strip().split()
            if len(parts) >= 2:
                installed_version = parts[1]
                # Check if versions differ
                if installed_version not in running_kernel:
                    return True

        # Check if systemd was updated (requires reboot)
        # For simplicity, check if systemd service needs restart
        rc, _ = run_cmd(["systemctl", "is-system-running"], timeout=5)
        if rc not in [0, 1]:  # 0=running, 1=degraded (both ok)
            return True

        return False

    def install_aur_helper(self):
        """Install yay AUR helper if not present (requires manual intervention)"""
        if self.aur_helper:
            return 0, f"AUR helper '{self.aur_helper}' already installed"

        # Check if git and base-devel are installed
        rc, _ = run_cmd(["pacman", "-Q", "git"], timeout=5)
        if rc != 0:
            return (
                1,
                "git is required but not installed. Install with: pacman -S git base-devel",
            )

        # Note: Installing yay requires building from AUR, which needs a non-root user
        # This is typically done manually or via a setup script
        return (
            1,
            "AUR helper installation requires manual setup. See: https://github.com/Jguer/yay#installation",
        )


class ZypperManager(BasePackageManager):
    """Package manager for openSUSE using zypper"""

    def list_installed(self):
        """List all installed packages"""
        rc, out = run_cmd(
            [
                "rpm",
                "-qa",
                "--queryformat",
                "%{NAME}\t%{VERSION}-%{RELEASE}\tinstalled\n",
            ],
            timeout=30,
        )
        if rc != 0:
            return []

        result = []
        for line in out.strip().split("\n"):
            if not line.strip():
                continue
            parts = line.split("\t")
            if len(parts) >= 2:
                result.append(
                    {
                        "name": parts[0],
                        "version": parts[1],
                        "status": parts[2] if len(parts) > 2 else "installed",
                    }
                )
        return result

    def list_upgradable(self):
        """List packages with available updates"""
        rc, out = run_cmd(["zypper", "list-updates"], timeout=60)
        if rc != 0:
            return []

        result = []
        in_table = False
        for line in out.strip().split("\n"):
            if not line.strip():
                continue
            # Skip header lines
            if "S | Repository" in line or "--|--" in line:
                in_table = True
                continue
            if not in_table:
                continue

            # Parse table format: v | repo | name | current -> available
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 4:
                pkg_name = parts[2]
                versions = parts[3].split("->")
                if len(versions) == 2:
                    result.append(
                        {
                            "name": pkg_name,
                            "current_version": versions[0].strip(),
                            "candidate_version": versions[1].strip(),
                        }
                    )
        return result

    def refresh(self):
        """Refresh package repositories"""
        rc, out = run_cmd(["zypper", "refresh"], timeout=120)
        return rc == 0

    def install(
        self,
        packages,
        local=False,
        security_only=False,
        exclude_kernel=False,
        extra_flags=None,
    ):
        """Install packages"""
        if not packages:
            return 0, "No packages specified"

        # Filter kernel packages if requested
        if exclude_kernel:
            packages = [p for p in packages if not p.startswith("kernel-")]

        if not packages:
            return 0, "All packages filtered out"

        # Build command
        if local:
            cmd = ["zypper", "--non-interactive", "install", "--allow-unsigned-rpm"]
        else:
            cmd = ["zypper", "--non-interactive", "install"]

        # Security-only updates
        if security_only and not local:
            cmd = ["zypper", "--non-interactive", "patch", "--category", "security"]
            rc, out = run_cmd(cmd, timeout=3600)
            return rc, out

        # Add extra flags
        if extra_flags:
            cmd.extend(extra_flags)

        cmd.extend(packages)
        rc, out = run_cmd(cmd, timeout=3600)
        return rc, out

    def remove(self, packages):
        """Remove packages"""
        if not packages:
            return 0, "No packages specified"

        cmd = ["zypper", "--non-interactive", "remove"] + packages
        rc, out = run_cmd(cmd, timeout=600)
        return rc, out

    def check_reboot(self):
        """Check if system reboot is required"""
        # Check for reboot-needed file
        if os.path.exists("/var/run/reboot-needed"):
            return True

        # Check with zypper ps
        rc, out = run_cmd(["zypper", "ps", "-s"], timeout=10)
        if rc == 0 and "reboot" in out.lower():
            return True

        # Check if kernel was updated
        rc, running_kernel = run_cmd(["uname", "-r"], timeout=5)
        if rc != 0:
            return False

        running_kernel = running_kernel.strip()

        # Get installed kernel version
        rc, out = run_cmd(["rpm", "-q", "kernel-default"], timeout=5)
        if rc == 0:
            # Parse version from rpm output
            for line in out.strip().split("\n"):
                if "kernel-default" in line:
                    # Extract version from package name
                    if running_kernel not in line:
                        return True

        return False


class ApkManager(BasePackageManager):
    """Package manager for Alpine Linux using apk"""

    def list_installed(self):
        """List all installed packages"""
        rc, out = run_cmd(["apk", "info", "-v"], timeout=30)
        if rc != 0:
            return []

        result = []
        for line in out.strip().split("\n"):
            if not line.strip():
                continue
            # Format: package-name-version
            # Split on last dash to separate name and version
            parts = line.rsplit("-", 2)
            if len(parts) >= 2:
                pkg_name = "-".join(parts[:-2]) if len(parts) > 2 else parts[0]
                pkg_version = "-".join(parts[-2:])
                result.append(
                    {"name": pkg_name, "version": pkg_version, "status": "installed"}
                )
        return result

    def list_upgradable(self):
        """List packages with available updates"""
        rc, out = run_cmd(["apk", "version", "-l", "<"], timeout=30)
        if rc != 0:
            return []

        result = []
        for line in out.strip().split("\n"):
            if not line.strip():
                continue
            # Format: package-name-current < package-name-available
            parts = line.split()
            if len(parts) >= 3 and parts[1] == "<":
                # Extract package name and versions
                current = parts[0]
                available = parts[2]

                # Parse package name (remove version)
                pkg_parts = current.rsplit("-", 2)
                if len(pkg_parts) >= 2:
                    pkg_name = (
                        "-".join(pkg_parts[:-2]) if len(pkg_parts) > 2 else pkg_parts[0]
                    )
                    current_ver = "-".join(pkg_parts[-2:])

                    avail_parts = available.rsplit("-", 2)
                    avail_ver = (
                        "-".join(avail_parts[-2:])
                        if len(avail_parts) >= 2
                        else available
                    )

                    result.append(
                        {
                            "name": pkg_name,
                            "current_version": current_ver,
                            "candidate_version": avail_ver,
                        }
                    )
        return result

    def refresh(self):
        """Update package index"""
        rc, out = run_cmd(["apk", "update"], timeout=120)
        return rc == 0

    def install(
        self,
        packages,
        local=False,
        security_only=False,
        exclude_kernel=False,
        extra_flags=None,
    ):
        """Install packages"""

        # NEW: Security-only filtering via backend CVE database
        if security_only and not local and not packages:
            # Get all upgradable packages
            upgradable = self.list_upgradable()
            if not upgradable:
                return 0, "No upgradable packages"

            # Query backend for security packages
            security_pkgs = self._filter_security_packages(upgradable)
            if not security_pkgs:
                return 0, "No security updates available"

            packages = security_pkgs

        if not packages:
            return 0, "No packages specified"

        # Filter kernel packages if requested
        if exclude_kernel:
            packages = [p for p in packages if not p.startswith("linux-")]

        if not packages:
            return 0, "All packages filtered out"

        # Build command
        cmd = ["apk", "add"]

        # Add extra flags
        if extra_flags:
            cmd.extend(extra_flags)
        else:
            cmd.append("--no-interactive")

        cmd.extend(packages)

        rc, out = run_cmd(cmd, timeout=3600)
        return rc, out

    def remove(self, packages):
        """Remove packages"""
        if not packages:
            return 0, "No packages specified"

        cmd = ["apk", "del", "--no-interactive"] + packages
        rc, out = run_cmd(cmd, timeout=600)
        return rc, out

    def check_reboot(self):
        """Check if system reboot is required"""
        # Check if kernel was updated
        rc, running_kernel = run_cmd(["uname", "-r"], timeout=5)
        if rc != 0:
            return False

        running_kernel = running_kernel.strip()

        # Get installed kernel version
        rc, out = run_cmd(["apk", "info", "-v", "linux-lts"], timeout=5)
        if rc != 0:
            # Try other kernel packages
            rc, out = run_cmd(["apk", "info", "-v", "linux-virt"], timeout=5)

        if rc == 0:
            # Check if installed version differs from running
            if running_kernel not in out:
                return True

        return False


class FreeBSDPkgManager(BasePackageManager):
    """Package manager for FreeBSD using pkg"""

    def list_installed(self):
        """List all installed packages"""
        rc, out = run_cmd(["pkg", "info"], timeout=30)
        if rc != 0:
            return []

        result = []
        for line in out.strip().split("\n"):
            if not line.strip():
                continue
            # Format: package-name-version  Description
            parts = line.split()
            if len(parts) >= 1:
                # Split package-version
                pkg_full = parts[0]
                pkg_parts = pkg_full.rsplit("-", 1)
                if len(pkg_parts) == 2:
                    result.append(
                        {
                            "name": pkg_parts[0],
                            "version": pkg_parts[1],
                            "status": "installed",
                        }
                    )
        return result

    def list_upgradable(self):
        """List packages with available updates"""
        rc, out = run_cmd(["pkg", "version", "-l", "<"], timeout=30)
        if rc != 0:
            return []

        result = []
        for line in out.strip().split("\n"):
            if not line.strip():
                continue
            # Format: package-name-version < needs updating (index has newer version)
            parts = line.split()
            if len(parts) >= 2 and parts[1] == "<":
                pkg_full = parts[0]
                pkg_parts = pkg_full.rsplit("-", 1)
                if len(pkg_parts) == 2:
                    result.append(
                        {
                            "name": pkg_parts[0],
                            "current_version": pkg_parts[1],
                            "candidate_version": "newer",  # pkg doesn't show exact version
                        }
                    )
        return result

    def refresh(self):
        """Update package repository catalog"""
        rc, out = run_cmd(["pkg", "update", "-f"], timeout=120)
        return rc == 0

    def install(
        self,
        packages,
        local=False,
        security_only=False,
        exclude_kernel=False,
        extra_flags=None,
    ):
        """Install packages"""

        # NEW: Security-only filtering via backend CVE database
        if security_only and not local and not packages:
            # Get all upgradable packages
            upgradable = self.list_upgradable()
            if not upgradable:
                return 0, "No upgradable packages"

            # Query backend for security packages
            security_pkgs = self._filter_security_packages(upgradable)
            if not security_pkgs:
                return 0, "No security updates available"

            packages = security_pkgs

        if not packages:
            return 0, "No packages specified"

        # Filter kernel packages if requested
        if exclude_kernel:
            packages = [p for p in packages if not p.startswith("kernel")]

        if not packages:
            return 0, "All packages filtered out"

        # Build command
        cmd = ["pkg", "install", "-y"]

        # Add extra flags
        if extra_flags:
            cmd.extend(extra_flags)

        cmd.extend(packages)

        rc, out = run_cmd(cmd, timeout=3600)
        return rc, out

    def remove(self, packages):
        """Remove packages"""
        if not packages:
            return 0, "No packages specified"

        cmd = ["pkg", "delete", "-y"] + packages
        rc, out = run_cmd(cmd, timeout=600)
        return rc, out

    def check_reboot(self):
        """Check if system reboot is required"""
        # Check if kernel was updated
        rc, running_kernel = run_cmd(["uname", "-r"], timeout=5)
        if rc != 0:
            return False

        running_kernel = running_kernel.strip()

        # Check if there's a newer kernel installed
        rc, out = run_cmd(["pkg", "info", "FreeBSD-kernel"], timeout=5)
        if rc == 0:
            # Parse version from output
            for line in out.strip().split("\n"):
                if "Version" in line:
                    version = line.split(":")[-1].strip()
                    if version not in running_kernel:
                        return True

        return False


def get_pkg_manager():
    if IS_WINDOWS:
        return WinManager()

    # Check for Solaris (uses IPS/pkg)
    if _check_solaris():
        return SolarisManager() if SolarisManager else BasePackageManager()

    # Check for HP-UX (uses SD-UX/swinstall)
    if _check_hpux():
        return HPUXManager() if HPUXManager else BasePackageManager()

    # Check for AIX (uses installp/NIM)
    if _check_aix():
        return AIXManager() if AIXManager else BasePackageManager()

    # Check for FreeBSD (uses pkg)
    if platform.system() == "FreeBSD" or os.path.exists("/usr/local/sbin/pkg"):
        return FreeBSDPkgManager()

    # Check for Alpine Linux (uses apk)
    if os.path.exists("/sbin/apk") or os.path.exists("/usr/sbin/apk"):
        if os.path.exists("/etc/alpine-release"):
            return ApkManager()
        # Also check os-release
        if os.path.exists("/etc/os-release"):
            try:
                with open("/etc/os-release") as f:
                    content = f.read().lower()
                    if "id=alpine" in content:
                        return ApkManager()
            except (IOError, OSError):
                pass

    # Check for openSUSE (uses zypper)
    if os.path.exists("/usr/bin/zypper"):
        return ZypperManager()

    # Check for Arch Linux (uses pacman)
    if os.path.exists("/usr/bin/pacman"):
        # Verify it's actually Arch Linux
        if os.path.exists("/etc/arch-release"):
            return PacmanManager()
        # Also check os-release for Arch-based distros (Manjaro, EndeavourOS, etc.)
        if os.path.exists("/etc/os-release"):
            try:
                with open("/etc/os-release") as f:
                    content = f.read().lower()
                    if (
                        "id=arch" in content
                        or "id_like=arch" in content
                        or "id=manjaro" in content
                    ):
                        return PacmanManager()
            except (IOError, OSError):
                pass

    # Check for Amazon Linux (uses yum/dnf)
    if os.path.exists("/etc/system-release"):
        try:
            with open("/etc/system-release") as f:
                content = f.read().lower()
                if "amazon linux" in content:
                    # Amazon Linux 2023+ uses dnf, AL2 uses yum
                    if os.path.exists("/usr/bin/dnf"):
                        return DnfManager()
                    elif os.path.exists("/usr/bin/yum"):
                        return DnfManager()  # DnfManager handles both yum and dnf
        except (IOError, OSError):
            pass

    # Standard detection
    if os.path.exists("/usr/bin/apt-get"):
        return AptManager()
    if os.path.exists("/usr/bin/dnf"):
        return DnfManager()  # Fedora, RHEL 8+, CentOS 8+
    if os.path.exists("/usr/bin/yum"):
        return DnfManager()  # Fallback for RHEL/CentOS

    return BasePackageManager()


def _check_solaris() -> bool:
    """Check if running on Solaris/OpenSolaris."""
    try:
        # Check kernel name
        rc, out = run_cmd(["uname", "-s"], timeout=5)
        if rc == 0:
            system = out.strip().lower()
            if "sunos" in system or "solaris" in system:
                return True

        # Check for Solaris-specific files
        if os.path.exists("/usr/sbin/unixd"):
            return True
        if os.path.exists("/etc/release"):
            try:
                with open("/etc/release") as f:
                    content = f.read().lower()
                    if "solaris" in content or "opensolaris" in content:
                        return True
            except (IOError, OSError):
                pass
    except (IOError, OSError):
        pass
    return False


def _check_hpux() -> bool:
    """Check if running on HP-UX."""
    try:
        # Check kernel name
        rc, out = run_cmd(["uname", "-s"], timeout=5)
        if rc == 0:
            system = out.strip().lower()
            if "hp-ux" in system or "hpux" in system:
                return True

        # Check for HP-UX-specific files
        if os.path.exists("/usr/sbin/swagentd"):
            return True
        if os.path.exists("/usr/sbin/swinstall"):
            return True
    except (IOError, OSError):
        pass
    return False


def _check_aix() -> bool:
    """Check if running on AIX."""
    try:
        # Check kernel name
        rc, out = run_cmd(["uname", "-s"], timeout=5)
        if rc == 0:
            system = out.strip().lower()
            if system == "aix":
                return True

        # Check for AIX-specific files
        if os.path.exists("/etc/AIX"):
            return True
        if os.path.exists("/usr/sbin/nimclient"):
            return True
    except (IOError, OSError):
        pass
    return False


def get_solaris_manager():
    """Get SolarisManager if on Solaris, else None."""
    if SolarisManager and _check_solaris():
        return SolarisManager()
    return None


def get_hpux_manager():
    """Get HPUXManager if on HP-UX, else None."""
    if HPUXManager and _check_hpux():
        return HPUXManager()
    return None


def get_aix_manager():
    """Get AIXManager if on AIX, else None."""
    if AIXManager and _check_aix():
        return AIXManager()
    return None


def detect_package_manager():
    """Detect and return the appropriate package manager.

    Returns:
        A tuple of (manager_name, manager_instance) for the detected OS.
    """
    if IS_WINDOWS:
        return ("windows", WinManager())

    if _check_solaris() and SolarisManager:
        return ("solaris", SolarisManager())
    if _check_hpux() and HPUXManager:
        return ("hpux", HPUXManager())
    if _check_aix() and AIXManager:
        return ("aix", AIXManager())

    if platform.system() == "FreeBSD" or os.path.exists("/usr/local/sbin/pkg"):
        return ("freebsd", FreeBSDPkgManager())

    if os.path.exists("/sbin/apk") or os.path.exists("/usr/sbin/apk"):
        if os.path.exists("/etc/alpine-release"):
            return ("alpine", ApkManager())
        if os.path.exists("/etc/os-release"):
            try:
                with open("/etc/os-release") as f:
                    content = f.read().lower()
                    if "id=alpine" in content:
                        return ("alpine", ApkManager())
            except (IOError, OSError):
                pass

    if os.path.exists("/usr/bin/zypper"):
        return ("opensuse", ZypperManager())

    if os.path.exists("/usr/bin/pacman"):
        if os.path.exists("/etc/arch-release"):
            return ("arch", PacmanManager())
        if os.path.exists("/etc/os-release"):
            try:
                with open("/etc/os-release") as f:
                    content = f.read().lower()
                    if (
                        "id=arch" in content
                        or "id_like=arch" in content
                        or "id=manjaro" in content
                    ):
                        return ("arch", PacmanManager())
            except (IOError, OSError):
                pass

    if os.path.exists("/usr/bin/apt-get"):
        return ("debian", AptManager())
    if os.path.exists("/usr/bin/dnf"):
        return ("rhel", DnfManager())
    if os.path.exists("/usr/bin/yum"):
        return ("rhel", DnfManager())

    return ("unknown", BasePackageManager())


pkg_mgr = get_pkg_manager()

# --- Rest of the code ---


JOB_STATUS = {
    "state": "idle",
    "current_job": None,
    "progress": 0,
    "log": [],
    "last_result": None,
    "started_at": None,
}


# run_cmd is now defined earlier in the file (after _load_valid_tokens)


def _normalize_job_result(result):
    if isinstance(result, dict):
        if "success" in result:
            return result
        return {"success": True, "result": result}
    if isinstance(result, tuple) and len(result) >= 2:
        rc = int(result[0])
        out = result[1]
        return {
            "success": rc == 0,
            "rc": rc,
            "output": out,
            "message": str(out or ""),
        }
    if isinstance(result, bool):
        return {"success": result}
    if result is None:
        return {"success": True}
    return {"success": bool(result), "result": result}


def _load_shutdown_queue():
    with QUEUE_LOCK:
        try:
            if not os.path.isfile(SHUTDOWN_QUEUE_FILE):
                return []
            with open(SHUTDOWN_QUEUE_FILE, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            return data if isinstance(data, list) else []
        except Exception as exc:
            logger.error(f"Failed to load shutdown software queue: {exc}")
            return []


def _save_shutdown_queue(items):
    os.makedirs(os.path.dirname(SHUTDOWN_QUEUE_FILE) or ".", exist_ok=True)
    with QUEUE_LOCK:
        with open(SHUTDOWN_QUEUE_FILE, "w", encoding="utf-8") as fh:
            json.dump(items, fh, indent=2)


def _enqueue_shutdown_packages(action, packages, requested_by="", reason=""):
    item = {
        "id": str(uuid.uuid4()),
        "action": str(action or "install"),
        "packages": [str(pkg).strip() for pkg in (packages or []) if str(pkg).strip()],
        "requested_by": str(requested_by or "").strip(),
        "reason": str(reason or "").strip(),
        "queued_at": datetime.now(timezone.utc).isoformat(),
    }
    items = _load_shutdown_queue()
    items.append(item)
    _save_shutdown_queue(items)
    return item


def _execute_shutdown_queue():
    queued = _load_shutdown_queue()
    if not queued:
        return {
            "success": True,
            "executed": [],
            "failed": [],
            "message": "No queued shutdown installs",
        }

    executed = []
    failed_items = []
    for item in queued:
        action = str(item.get("action") or "install").strip().lower()
        packages = [
            str(pkg).strip() for pkg in (item.get("packages") or []) if str(pkg).strip()
        ]
        if not packages:
            continue
        if action == "remove":
            rc, out = pkg_mgr.remove(packages)
        else:
            rc, out = pkg_mgr.install(packages)
        result = {
            "id": item.get("id"),
            "action": action,
            "packages": packages,
            "rc": rc,
            "output": out,
            "success": rc == 0,
        }
        executed.append(result)
        if rc != 0:
            failed_copy = dict(item)
            failed_copy["last_error"] = str(out or "")
            failed_items.append(failed_copy)

    _save_shutdown_queue(failed_items)
    return {
        "success": len(failed_items) == 0,
        "executed": executed,
        "failed": failed_items,
        "message": "Shutdown install queue executed"
        if not failed_items
        else "One or more queued shutdown installs failed",
    }


def record_job(job_data):
    """Log job history to disk (simple JSON lines)."""
    with open(os.path.join(LOG_DIR, "jobs.jsonl"), "a") as f:
        f.write(json.dumps(job_data) + "\n")


def run_async_job(job_type, target_func, *args, **kwargs):
    """Run a job in a background thread."""
    if JOB_STATUS["state"] == "running":
        return False, "Another job is already running"

    def wrapper():
        JOB_STATUS["state"] = "running"
        JOB_STATUS["current_job"] = job_type
        JOB_STATUS["started_at"] = time.time()
        JOB_STATUS["progress"] = 0
        JOB_STATUS["log"] = []
        try:
            result = _normalize_job_result(target_func(*args, **kwargs))
            JOB_STATUS["state"] = "success" if result.get("success") else "failed"
            JOB_STATUS["last_result"] = result
        except Exception as e:
            JOB_STATUS["state"] = "failed"
            JOB_STATUS["last_result"] = {"error": str(e)}
            JOB_STATUS["log"].append(f"Critical Error: {str(e)}")
        finally:
            JOB_STATUS["progress"] = 100
            record_job(
                {
                    "type": job_type,
                    "status": JOB_STATUS["state"],
                    "result": JOB_STATUS["last_result"],
                    "ts": time.time(),
                }
            )
            # Reset to idle after a short delay or let client acknowledge?
            # For simplicity, we stay in success/failed state until next job starts,
            # but maybe auto-reset is risky if client misses it.
            # We'll rely on client polling to see 'success' then stop polling.
            # We can set state to idle on next job request start check.
            pass

    t = threading.Thread(target=wrapper)
    t.start()
    return True, "Job started"


@app.route("/job/status")
def job_status():
    return jsonify(JOB_STATUS)


@app.route("/job/reset", methods=["POST"])
@_require_auth
def job_reset():
    if JOB_STATUS["state"] == "running":
        return jsonify({"error": "Cannot reset running job"}), 400
    JOB_STATUS["state"] = "idle"
    JOB_STATUS["log"] = []
    JOB_STATUS["last_result"] = None
    return jsonify({"status": "reset"})


@app.route("/health")
def health():
    try:
        reboot_required = False
        checker = getattr(pkg_mgr, "check_reboot", None)
        if callable(checker):
            reboot_required = bool(checker())
        state = JOB_STATUS.get("state", "unknown")
        if not isinstance(state, str):
            state = str(state)
        return jsonify(
            {
                "status": "ok",
                "hostname": str(platform.node() or ""),
                "os": str(platform.system() or ""),
                "agent_version": str(__version__),
                "reboot_required": reboot_required,
                "state": state,
            }
        )
    except Exception as e:
        logger.error(f"Health endpoint failure: {e}")
        return jsonify({"status": "ok", "reboot_required": False, "state": "unknown"})


@app.route("/api/version")
def api_version():
    """Return agent version for version synchronization with backend."""
    return jsonify(
        {
            "version": str(__version__),
        }
    )


@app.route("/api/debug/memory")
def debug_memory():
    """Return memory profiling information for leak detection."""
    global _memory_baseline_bytes, _memory_baseline_set_time
    try:
        process = psutil.Process()
        mem_info = process.memory_info()
        current_rss = mem_info.rss
        current_vms = mem_info.vms
        uptime = time.time() - psutil.boot_time()
        delta = (
            max(0, current_rss - _memory_baseline_bytes)
            if _memory_baseline_bytes > 0
            else 0
        )
        return jsonify(
            {
                "current_rss_bytes": current_rss,
                "current_vms_bytes": current_vms,
                "baseline_rss_bytes": _memory_baseline_bytes,
                "delta_from_baseline_bytes": delta,
                "uptime_seconds": uptime,
                "active_threads": threading.active_count(),
                "baseline_set_time": _memory_baseline_set_time,
            }
        )
    except Exception as e:
        logger.error(f"Memory debug endpoint error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/debug/gc", methods=["POST"])
@_require_auth
def debug_gc():
    """Trigger garbage collection and return freed bytes estimate."""
    try:
        import gc

        gc.collect()
        # Get memory before and after to estimate freed bytes
        process = psutil.Process()
        mem_before = process.memory_info().rss
        # Force collect and get stats
        collected = gc.collect()
        mem_after = process.memory_info().rss
        freed_estimate = max(0, mem_before - mem_after)
        return jsonify(
            {
                "objects_collected": collected,
                "freed_bytes_estimate": freed_estimate,
            }
        )
    except Exception as e:
        logger.error(f"GC endpoint error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/system/reboot", methods=["POST"])
@_require_auth
def system_reboot():
    """Trigger a reboot and process queued shutdown installs first."""
    data = request.get_json(silent=True) or {}
    run_shutdown_queue = bool(data.get("run_shutdown_queue", True))

    def _task():
        queue_result = {
            "success": True,
            "executed": [],
            "failed": [],
            "message": "Skipped shutdown queue",
        }
        if run_shutdown_queue:
            queue_result = _execute_shutdown_queue()
            if not queue_result.get("success"):
                return {
                    "success": False,
                    "message": "Queued shutdown installs failed",
                    "queue": queue_result,
                }
        if IS_WINDOWS:
            rc, out = run_cmd(["shutdown", "/r", "/t", "5"])
        else:
            rc, out = run_cmd(["shutdown", "-r", "+1"])
        return {
            "success": rc == 0,
            "status": "reboot_scheduled" if rc == 0 else "reboot_failed",
            "rc": rc,
            "output": out,
            "queue": queue_result,
        }

    ok, msg = run_async_job("reboot", _task)
    if not ok:
        return jsonify({"error": msg}), 409
    return jsonify({"status": "reboot_scheduled"})


@app.route("/system/shutdown", methods=["POST"])
@_require_auth
def system_shutdown():
    """Trigger a shutdown and process queued shutdown installs first."""
    data = request.get_json(silent=True) or {}
    run_shutdown_queue = bool(data.get("run_shutdown_queue", True))

    def _task():
        queue_result = {
            "success": True,
            "executed": [],
            "failed": [],
            "message": "Skipped shutdown queue",
        }
        if run_shutdown_queue:
            queue_result = _execute_shutdown_queue()
            if not queue_result.get("success"):
                return {
                    "success": False,
                    "message": "Queued shutdown installs failed",
                    "queue": queue_result,
                }
        if IS_WINDOWS:
            rc, out = run_cmd(["shutdown", "/s", "/t", "5"])
        else:
            rc, out = run_cmd(["shutdown", "-h", "+1"])
        return {
            "success": rc == 0,
            "status": "shutdown_scheduled" if rc == 0 else "shutdown_failed",
            "rc": rc,
            "output": out,
            "queue": queue_result,
        }

    ok, msg = run_async_job("shutdown", _task)
    if not ok:
        return jsonify({"error": msg}), 409
    return jsonify({"status": "shutdown_scheduled"})


@app.route("/software/manage", methods=["POST"])
@_require_auth
def software_manage():
    """Install or remove generic software."""
    data = request.get_json(silent=True) or {}
    action = data.get("action", "install")  # install | remove
    packages = data.get("packages", [])
    if not packages:
        return jsonify({"error": "No packages specified"}), 400

    def _task():
        if action == "remove":
            return pkg_mgr.remove(packages)
        return pkg_mgr.install(packages)

    ok, msg = run_async_job(f"software_{action}", _task)
    if not ok:
        return jsonify({"error": msg}), 409
    return jsonify({"status": "started", "job": f"software_{action}"})


@app.route("/software/queue", methods=["GET"])
@_require_auth
def software_queue_list():
    items = _load_shutdown_queue()
    return jsonify({"count": len(items), "items": items})


@app.route("/software/queue", methods=["POST"])
@_require_auth
def software_queue_add():
    data = request.get_json(silent=True) or {}
    action = str(data.get("action") or "install").strip().lower()
    packages = [
        str(pkg).strip() for pkg in (data.get("packages") or []) if str(pkg).strip()
    ]
    if action not in {"install", "remove"}:
        return jsonify({"error": "Unsupported action"}), 400
    if not packages:
        return jsonify({"error": "No packages specified"}), 400
    item = _enqueue_shutdown_packages(
        action=action,
        packages=packages,
        requested_by=data.get("requested_by", ""),
        reason=data.get("reason", ""),
    )
    return jsonify(
        {"status": "queued", "item": item, "count": len(_load_shutdown_queue())}
    )


@app.route("/software/queue", methods=["DELETE"])
@_require_auth
def software_queue_clear():
    _save_shutdown_queue([])
    return jsonify({"status": "cleared"})


def _run_powershell(script, timeout=600):
    exe = "powershell"
    return run_cmd(
        [exe, "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
        timeout=timeout,
    )


def _powershell_json(script, timeout=600):
    rc, out = _run_powershell(script, timeout=timeout)
    if rc != 0:
        raise Exception(out)
    txt = (out or "").strip()
    if not txt:
        return None
    try:
        return json.loads(txt)
    except Exception:
        raise Exception(txt)


@app.route("/wsus/updates")
@_require_auth
def wsus_updates():
    if not IS_WINDOWS:
        return jsonify({"error": "WSUS is only available on Windows agents"}), 400
    WSUS_CACHE["status"] = "scanning"
    WSUS_CACHE["last_error"] = None
    script = (
        "$s=New-Object -ComObject Microsoft.Update.Session;"
        "$searcher=$s.CreateUpdateSearcher();"
        "$r=$searcher.Search(\"IsInstalled=0 and Type='Software'\");"
        "$r.Updates | Select-Object Title,KBArticleIDs,MsrcSeverity,RebootRequired,IsInstalled,IsDownloaded,LastDeploymentChangeTime,@{Name='MaxDownloadSize';Expression={$_.MaxDownloadSize}},@{Name='UpdateID';Expression={$_.Identity.UpdateID}},@{Name='RevisionNumber';Expression={$_.Identity.RevisionNumber}},@{Name='Categories';Expression={$_.Categories | Select-Object -ExpandProperty Name}},@{Name='CVEIDs';Expression={$_.CveIDs}} | ConvertTo-Json -Depth 6"
    )
    try:
        data = _powershell_json(script, timeout=240)
        if data is None:
            data = []
        if isinstance(data, dict):
            data = [data]
        WSUS_CACHE["pending"] = data
        WSUS_CACHE["last_scan"] = datetime.now(timezone.utc).isoformat()
        WSUS_CACHE["status"] = "idle"
        return jsonify({"count": len(data), "updates": data})
    except Exception as e:
        WSUS_CACHE["status"] = "error"
        WSUS_CACHE["last_error"] = str(e)
        return jsonify({"error": str(e)}), 500


@app.route("/wsus/install", methods=["POST"])
@_require_auth
def wsus_install():
    if not IS_WINDOWS:
        return jsonify({"error": "WSUS is only available on Windows agents"}), 400

    WSUS_CACHE["status"] = "installing"
    WSUS_CACHE["last_error"] = None

    payload = request.get_json(silent=True) or {}
    update_ids = payload.get("update_ids") if isinstance(payload, dict) else None
    if not isinstance(update_ids, list):
        update_ids = []
    update_ids = [str(x).strip() for x in update_ids if str(x).strip()]

    def _task(selected_update_ids=None):
        filter_clause = ""
        if selected_update_ids:
            # build a PowerShell array of IDs and filter
            filter_clause = (
                ";$ids=@("
                + ";".join([f"'{uid}'" for uid in selected_update_ids])
                + ");$sel=@();foreach($u in $r.Updates){if($ids -contains $u.Identity.UpdateID){$sel+=$u}};$updates=$sel"
            )
        else:
            filter_clause = ";$updates=New-Object -ComObject Microsoft.Update.UpdateColl;foreach($u in $r.Updates){[void]$updates.Add($u)}"
        script = (
            "$s=New-Object -ComObject Microsoft.Update.Session;"
            "$searcher=$s.CreateUpdateSearcher();"
            "$r=$searcher.Search(\"IsInstalled=0 and Type='Software'\");"
            f"{filter_clause};"
            "$down=$s.CreateUpdateDownloader();$down.Updates=$updates;[void]$down.Download();"
            "$inst=$s.CreateUpdateInstaller();$inst.Updates=$updates;$res=$inst.Install();"
            "$res | ConvertTo-Json -Depth 6"
        )
        rc, out = _run_powershell(script, timeout=3600)
        success = rc == 0
        if success:
            WSUS_CACHE["pending"] = []
            WSUS_CACHE["status"] = "idle"
        else:
            WSUS_CACHE["status"] = "error"
            WSUS_CACHE["last_error"] = out
        return {"success": success, "output": out}

    ok, msg = run_async_job("wsus_install", _task, update_ids)
    if not ok:
        return jsonify({"error": msg}), 409
    return jsonify({"status": "started"})


@app.route("/wsus/download", methods=["POST"])
@_require_auth
def wsus_download():
    if not IS_WINDOWS:
        return jsonify({"error": "WSUS is only available on Windows agents"}), 400
    WSUS_CACHE["status"] = "downloading"
    WSUS_CACHE["last_error"] = None
    payload = request.get_json(silent=True) or {}
    update_ids = payload.get("update_ids") if isinstance(payload, dict) else None
    if not isinstance(update_ids, list):
        update_ids = []
    update_ids = [str(x).strip() for x in update_ids if str(x).strip()]

    def _task(selected_update_ids=None):
        filter_clause = ""
        if selected_update_ids:
            filter_clause = (
                ";$ids=@("
                + ";".join([f"'{uid}'" for uid in selected_update_ids])
                + ");$sel=@();foreach($u in $r.Updates){if($ids -contains $u.Identity.UpdateID){$sel+=$u}};$updates=$sel"
            )
        else:
            filter_clause = ";$updates=New-Object -ComObject Microsoft.Update.UpdateColl;foreach($u in $r.Updates){[void]$updates.Add($u)}"
        script = (
            "$s=New-Object -ComObject Microsoft.Update.Session;"
            "$searcher=$s.CreateUpdateSearcher();"
            "$r=$searcher.Search(\"IsInstalled=0 and Type='Software'\");"
            f"{filter_clause};"
            "$down=$s.CreateUpdateDownloader();$down.Updates=$updates;$res=$down.Download();"
            "$res | ConvertTo-Json -Depth 6"
        )
        rc, out = _run_powershell(script, timeout=3600)
        success = rc == 0
        if success:
            WSUS_CACHE["status"] = "idle"
        else:
            WSUS_CACHE["status"] = "error"
            WSUS_CACHE["last_error"] = out
        return {"success": success, "output": out}

    ok, msg = run_async_job("wsus_download", _task, update_ids)
    if not ok:
        return jsonify({"error": msg}), 409
    return jsonify({"status": "started"})


@app.route("/wsus/status")
def wsus_status():
    if not IS_WINDOWS:
        return jsonify({"error": "WSUS is only available on Windows agents"}), 400
    rc, out = _run_powershell(
        "Get-Service wuauserv | Select-Object Status,StartType,Name | ConvertTo-Json -Depth 4",
        timeout=30,
    )
    service_payload = None
    if rc == 0:
        try:
            service_payload = json.loads(out)
        except Exception:
            service_payload = {"raw": out}
    return jsonify(
        {
            "service": service_payload,
            "status": WSUS_CACHE.get("status"),
            "pending_count": len(WSUS_CACHE.get("pending") or []),
            "last_scan": WSUS_CACHE.get("last_scan"),
            "last_error": WSUS_CACHE.get("last_error"),
        }
    )


# === PACKAGE LISTING ===


@app.route("/packages/installed")
def packages_installed():
    packages = pkg_mgr.list_installed()
    return jsonify({"packages": packages, "count": len(packages)})


@app.route("/packages/refresh", methods=["POST"])
@_require_auth
def packages_refresh():
    """Refresh package cache."""
    rc, out = pkg_mgr.refresh()
    return jsonify({"success": rc == 0, "output": out})


@app.route("/packages/upgradable")
def packages_upgradable():
    packages = pkg_mgr.list_upgradable()
    return jsonify({"packages": packages, "count": len(packages)})


@app.route("/packages/uris", methods=["POST"])
@_require_auth
def packages_uris():
    """Return download URIs for specified packages. Supports apt (deb) and dnf/yum (rpm)."""
    data = request.get_json(silent=True) or {}
    pkg_names = data.get("packages", [])
    uris = []

    if isinstance(pkg_mgr, AptManager):
        cmd = (
            ["apt-get", "--print-uris", "-y", "install"] + pkg_names
            if pkg_names
            else ["apt-get", "--print-uris", "-y", "upgrade"]
        )
        rc, out = run_cmd(cmd, timeout=60)
        for line in out.strip().splitlines():
            line = line.strip()
            if not line.startswith("'") or ".deb" not in line:
                continue
            parts = line.split(" ")
            if len(parts) >= 2:
                url = parts[0].strip("'")
                filename = parts[1]
                size = parts[2] if len(parts) > 2 else "0"
                uris.append({"url": url, "filename": filename, "size": size})

    elif isinstance(pkg_mgr, DnfManager):
        # dnf download --url prints download URLs to stdout
        targets = pkg_names if pkg_names else []
        if not targets:
            # Get list of upgradable packages first
            upgradable = pkg_mgr.list_upgradable()
            targets = [p["name"] for p in upgradable]
        if targets:
            rc, out = run_cmd(
                ["dnf", "download", "--url", "--resolve"] + targets, timeout=60
            )
            for line in out.strip().splitlines():
                line = line.strip()
                if line.startswith("http://") or line.startswith("https://"):
                    filename = line.split("/")[-1]
                    uris.append({"url": line, "filename": filename, "size": "0"})

    return jsonify({"uris": uris, "count": len(uris)})


# === SNAPSHOTS (packages / services / full-system images) ===


def _capture_services(selected=None):
    data = {"services": []}
    try:
        if IS_WINDOWS:
            # Use PowerShell for structured output
            cmd = [
                "powershell",
                "-Command",
                "Get-Service | Select Name,Status,StartType | ConvertTo-Json -Compress",
            ]
            rc, out = run_cmd(cmd, timeout=60)
            if rc == 0:
                data["services"] = json.loads(out)
        else:
            cmd = [
                "systemctl",
                "list-unit-files",
                "--type=service",
                "--no-legend",
                "--no-pager",
            ]
            rc, out = run_cmd(cmd, timeout=60)
            if rc == 0:
                for line in out.splitlines():
                    parts = line.split()
                    if len(parts) >= 2:
                        data["services"].append({"name": parts[0], "state": parts[1]})
        if selected:
            sel_lower = {s.lower() for s in selected}
            data["services"] = [
                s for s in data["services"] if s.get("name", "").lower() in sel_lower
            ]
    except Exception as e:
        data["error"] = str(e)
    return data


def _bytes_to_human(value):
    num = float(max(int(value or 0), 0))
    units = ["B", "KB", "MB", "GB", "TB"]
    idx = 0
    while num >= 1024 and idx < len(units) - 1:
        num /= 1024.0
        idx += 1
    return f"{num:.1f} {units[idx]}"


def _resolve_windows_backup_target(windows_backup_target=None):
    target = (
        windows_backup_target
        or os.getenv("PM_WINDOWS_WBADMIN_TARGET")
        or os.getenv("WBADMIN_BACKUP_TARGET")
        or ""
    ).strip()
    if target:
        return target
    ps_pick = (
        "Get-Volume | Where-Object { $_.DriveLetter -and $_.DriveLetter -ne 'C' "
        "-and $_.DriveType -eq 'Fixed' -and $_.SizeRemaining -gt 10737418240 } "
        "| Sort-Object SizeRemaining -Descending "
        "| Select-Object -ExpandProperty DriveLetter | ConvertTo-Json -Compress"
    )
    rc_pick, out_pick = run_cmd(["powershell", "-Command", ps_pick], timeout=30)
    if rc_pick == 0 and out_pick.strip():
        try:
            parsed = json.loads(out_pick)
            if isinstance(parsed, list) and parsed:
                return f"{parsed[0]}:"
            if isinstance(parsed, str) and parsed:
                return f"{parsed}:"
        except Exception:
            return ""
    return ""


def _windows_target_free_bytes(target):
    raw = (target or "").strip()
    if len(raw) >= 2 and raw[1] == ":":
        drive_path = f"{raw[0]}:\\"
        try:
            return shutil.disk_usage(drive_path).free
        except Exception:
            return None
    ps = (
        "$t='{target}'; "
        "if (-not (Test-Path -LiteralPath $t)) {{ Write-Output ''; exit 0 }}; "
        "$item = Get-Item -LiteralPath $t; "
        "if ($item -and $item.PSDrive) {{ "
        "  [Console]::WriteLine(($item.PSDrive.Free | ConvertTo-Json -Compress)) "
        "}} else {{ Write-Output '' }}"
    ).format(target=raw.replace("'", "''"))
    rc, out = run_cmd(["powershell", "-Command", ps], timeout=20)
    if rc != 0 or not out.strip():
        return None
    try:
        parsed = json.loads(out.strip())
        return int(parsed)
    except Exception:
        try:
            return int(out.strip())
        except Exception:
            return None


def _parse_wbadmin_versions(output):
    versions = []
    for line in (output or "").splitlines():
        match = re.search(r"Version identifier:\s*(.+)", line, re.IGNORECASE)
        if match:
            versions.append(match.group(1).strip())
    return versions


def _detect_wbadmin_versions(target):
    if not target:
        return []
    rc, out = run_cmd(
        ["wbadmin", "get", "versions", f"-backuptarget:{target}"], timeout=120
    )
    if rc != 0:
        return []
    return _parse_wbadmin_versions(out)


def _windows_backup_manifest_path(base_path):
    if os.path.isdir(base_path):
        return os.path.join(base_path, "full_system_windows.json")
    return base_path


def _write_windows_backup_manifest(
    path, target, version_identifier="", command_output="", backup_mode="full_system"
):
    manifest = {
        "kind": "windows_wbadmin_backup",
        "backup_mode": backup_mode,
        "backup_target": target,
        "version_identifier": version_identifier or "",
        "created_at": datetime.now().isoformat(),
        "command_output": (command_output or "")[:800],
    }
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2)
    return manifest


def _load_windows_backup_manifest(path):
    manifest_path = _windows_backup_manifest_path(path)
    if not os.path.exists(manifest_path):
        return None
    with open(manifest_path) as f:
        data = json.load(f)
    if (
        data.get("kind") not in ("", "windows_wbadmin_backup", None)
        and "backup_target" not in data
    ):
        return None
    if not data.get("backup_target"):
        return None
    return data


def _resolve_windows_restore_manifest(source_path):
    manifest = _load_windows_backup_manifest(source_path)
    if not manifest:
        return None, None
    return manifest, _windows_backup_manifest_path(source_path)


def _restore_windows_backup_manifest(path, target_override=None):
    manifest = _load_windows_backup_manifest(path)
    if not manifest:
        return {"success": False, "error": "Windows backup manifest not found"}

    target = (target_override or manifest.get("backup_target") or "").strip()
    if not target:
        return {
            "success": False,
            "error": "Windows backup target is missing from manifest",
        }

    version = str(manifest.get("version_identifier") or "").strip()
    if not version:
        versions = _detect_wbadmin_versions(target)
        version = versions[0] if versions else ""
    if not version:
        return {
            "success": False,
            "error": f"No wbadmin version found at {target}",
            "backup_target": target,
        }

    attempts = []
    commands = [
        [
            "wbadmin",
            "start",
            "sysrecovery",
            f"-version:{version}",
            f"-backuptarget:{target}",
            "-quiet",
        ],
        [
            "wbadmin",
            "start",
            "systemstaterecovery",
            f"-version:{version}",
            f"-backuptarget:{target}",
            "-quiet",
        ],
    ]
    for command in commands:
        rc, out = run_cmd(command, timeout=7200)
        attempts.append(
            {
                "command": " ".join(command),
                "rc": rc,
                "output": out[:800],
            }
        )
        if rc == 0:
            return {
                "success": True,
                "backup_target": target,
                "version": version,
                "output": out[:800],
                "attempts": attempts,
            }

    return {
        "success": False,
        "error": "wbadmin restore failed",
        "backup_target": target,
        "version": version,
        "attempts": attempts,
    }


def _windows_package_identity(pkg):
    raw = str((pkg or {}).get("id") or (pkg or {}).get("name") or "").strip().lower()
    return raw or None


def _windows_install_snapshot_package(pkg):
    package_id = str((pkg or {}).get("id") or "").strip()
    package_name = str((pkg or {}).get("name") or "").strip()
    version = str((pkg or {}).get("version") or "").strip()
    if package_id:
        cmd = [
            "winget",
            "install",
            "--id",
            package_id,
            "--exact",
            "--silent",
            "--accept-package-agreements",
            "--accept-source-agreements",
        ]
        if version:
            cmd += ["--version", version, "--force"]
        return run_cmd(cmd, timeout=900)
    if package_name:
        cmd = [
            "winget",
            "install",
            "--name",
            package_name,
            "--exact",
            "--silent",
            "--accept-package-agreements",
            "--accept-source-agreements",
        ]
        if version:
            cmd += ["--version", version, "--force"]
        return run_cmd(cmd, timeout=900)
    return 1, "No Windows package identifier available"


def _windows_remove_snapshot_package(pkg):
    package_id = str((pkg or {}).get("id") or "").strip()
    package_name = str((pkg or {}).get("name") or "").strip()
    if package_id:
        return run_cmd(
            ["winget", "uninstall", "--id", package_id, "--exact", "--silent"],
            timeout=900,
        )
    if package_name:
        return run_cmd(
            ["winget", "uninstall", "--name", package_name, "--exact", "--silent"],
            timeout=900,
        )
    return 1, "No Windows package identifier available"


def _snapshot_precheck(mode="packages", windows_backup_target=None):
    normalized_mode = str(mode or "packages").strip().lower()
    pre = {
        "ok": True,
        "mode": normalized_mode,
        "os": platform.system(),
        "checks": [],
    }
    try:
        snap_usage = shutil.disk_usage(SNAPSHOT_DIR)
        pre["checks"].append(
            {
                "name": "snapshot_storage",
                "path": SNAPSHOT_DIR,
                "free_bytes": snap_usage.free,
                "free_human": _bytes_to_human(snap_usage.free),
            }
        )
    except Exception as e:
        pre["checks"].append({"name": "snapshot_storage", "error": str(e)})
    if normalized_mode != "full_system":
        return pre
    if IS_WINDOWS:
        target = _resolve_windows_backup_target(windows_backup_target)
        if not target:
            pre["ok"] = False
            pre["error_code"] = "no_backup_target"
            pre["error"] = (
                "No writable backup target available for Windows full-system image"
            )
            return pre
        free_bytes = _windows_target_free_bytes(target)
        min_required = int(
            (
                os.getenv("PM_WINDOWS_FULL_SNAPSHOT_MIN_FREE_BYTES") or "21474836480"
            ).strip()
        )
        check = {
            "name": "windows_backup_target",
            "target": target,
            "required_bytes": min_required,
            "required_human": _bytes_to_human(min_required),
            "free_bytes": free_bytes,
            "free_human": _bytes_to_human(free_bytes)
            if isinstance(free_bytes, int)
            else "unknown",
        }
        pre["checks"].append(check)
        pre["backup_target"] = target
        if isinstance(free_bytes, int) and free_bytes < min_required:
            pre["ok"] = False
            pre["error_code"] = "no_space"
            pre["error"] = f"Not enough free space on backup target {target}"
        return pre
    root_usage = shutil.disk_usage("/")
    estimated_image = max(int(root_usage.used * 0.35), 8 * 1024 * 1024 * 1024)
    min_required = int(
        max(
            int(estimated_image * 1.2),
            int(
                (
                    os.getenv("PM_LINUX_FULL_SNAPSHOT_MIN_FREE_BYTES") or "21474836480"
                ).strip()
            ),
        )
    )
    pre["checks"].append(
        {
            "name": "linux_full_system_space",
            "path": "/",
            "required_bytes": min_required,
            "required_human": _bytes_to_human(min_required),
            "estimated_image_bytes": estimated_image,
            "estimated_image_human": _bytes_to_human(estimated_image),
            "free_bytes": root_usage.free,
            "free_human": _bytes_to_human(root_usage.free),
        }
    )
    if root_usage.free < min_required:
        pre["ok"] = False
        pre["error_code"] = "no_space"
        pre["error"] = "Not enough free disk space for Linux full-system image"
    return pre


def _full_system_image(name, snap_dir, windows_backup_target=None):
    image_path = os.path.join(snap_dir, "full_image.tar.gz")
    if IS_WINDOWS:
        target = _resolve_windows_backup_target(windows_backup_target)
        if not target:
            raise Exception(
                "No writable backup target available for Windows full_system snapshot. Set PM_WINDOWS_WBADMIN_TARGET or attach writable drive/share."
            )
        versions_before = set(_detect_wbadmin_versions(target))
        cmd = [
            "wbadmin",
            "start",
            "backup",
            f"-backupTarget:{target}",
            "-allCritical",
            "-quiet",
        ]
        rc, out = run_cmd(cmd, timeout=7200)
        if rc != 0:
            raise Exception(f"wbadmin failed: {out[:400]}")
        versions_after = _detect_wbadmin_versions(target)
        version_identifier = next(
            (v for v in versions_after if v not in versions_before),
            versions_after[0] if versions_after else "",
        )
        manifest_path = _windows_backup_manifest_path(snap_dir)
        _write_windows_backup_manifest(
            manifest_path,
            target,
            version_identifier=version_identifier,
            command_output=out,
            backup_mode="full_system",
        )
        return {
            "manifest_path": manifest_path,
            "backup_target": target,
            "version_identifier": version_identifier,
            "image_size_bytes": os.path.getsize(manifest_path)
            if os.path.exists(manifest_path)
            else 0,
        }
    else:
        tmp_path = f"/tmp/{name}_full.tar.gz"
        cmd = [
            "tar",
            "czf",
            tmp_path,
            "--exclude=/proc",
            "--exclude=/sys",
            "--exclude=/dev",
            "--exclude=/tmp",
            "--exclude=/run",
            "--exclude=/mnt",
            "--exclude=/media",
            "--exclude=/lost+found",
            "--exclude=/var/lib/patch-agent/snapshots",
            "/",
        ]
        rc, out = run_cmd(cmd, timeout=7200)
        if rc != 0:
            raise Exception(f"Full system image failed: {out[:400]}")
        shutil.move(tmp_path, image_path)
        return os.path.getsize(image_path)


def _create_snapshot(
    name=None, mode="packages", selected_services=None, windows_backup_target=None
):
    if not name:
        # Bug #11 fix: use uuid suffix to prevent name collision when two snapshots
        # are created within the same second (e.g. concurrent requests)
        name = f"snap-{int(time.time())}-{uuid.uuid4().hex[:8]}"
    mode = mode or "packages"
    snap_dir = os.path.join(SNAPSHOT_DIR, name)
    os.makedirs(snap_dir, exist_ok=True)
    result = {
        "name": name,
        "path": snap_dir,
        "mode": mode,
        "success": False,
        "status": "running",
        "started_at": datetime.now().isoformat(),
        "details": {},
    }
    precheck = _snapshot_precheck(
        mode=mode, windows_backup_target=windows_backup_target
    )
    result["precheck"] = precheck
    if not precheck.get("ok", True):
        result["status"] = "failed"
        result["error"] = precheck.get("error") or "Snapshot precheck failed"
        result["error_code"] = precheck.get("error_code") or "precheck_failed"
        record_job({"type": "snapshot", **result})
        return result
    try:
        # Save current package list (always)
        packages = pkg_mgr.list_installed()
        with open(os.path.join(snap_dir, "packages.json"), "w") as f:
            json.dump(packages, f, indent=2)
        result["details"]["packages_count"] = len(packages)

        # Services snapshot (all or selected)
        if mode in ("services", "selected_services", "full_system"):
            svc = _capture_services(
                selected_services if mode == "selected_services" else None
            )
            with open(os.path.join(snap_dir, "services.json"), "w") as f:
                json.dump(svc, f, indent=2)
            result["details"]["services_count"] = len(svc.get("services", []))

        # OS-specific repo/source configs for Linux
        if not IS_WINDOWS:
            sources_dir = os.path.join(snap_dir, "sources")
            os.makedirs(sources_dir, exist_ok=True)

            # Debian/Ubuntu sources
            if os.path.exists("/etc/apt/sources.list"):
                shutil.copy2("/etc/apt/sources.list", sources_dir)
            if os.path.isdir("/etc/apt/sources.list.d"):
                for sf in os.listdir("/etc/apt/sources.list.d"):
                    shutil.copy2(
                        os.path.join("/etc/apt/sources.list.d", sf), sources_dir
                    )

            # RHEL/CentOS/Rocky/Alma repos
            if os.path.isdir("/etc/yum.repos.d"):
                for rf in os.listdir("/etc/yum.repos.d"):
                    shutil.copy2(os.path.join("/etc/yum.repos.d", rf), sources_dir)

            # Arch Linux pacman config and mirrorlist
            if isinstance(pkg_mgr, PacmanManager):
                if os.path.exists("/etc/pacman.conf"):
                    shutil.copy2("/etc/pacman.conf", sources_dir)
                if os.path.exists("/etc/pacman.d/mirrorlist"):
                    shutil.copy2("/etc/pacman.d/mirrorlist", sources_dir)

                # Save explicitly installed packages list (useful for Arch)
                rc, explicit_pkgs = run_cmd(["pacman", "-Qqe"], timeout=30)
                if rc == 0:
                    with open(
                        os.path.join(snap_dir, "explicit_packages.txt"), "w"
                    ) as f:
                        f.write(explicit_pkgs)
                    result["details"]["explicit_packages_count"] = len(
                        explicit_pkgs.strip().split("\n")
                    )

            # openSUSE zypper repos
            if isinstance(pkg_mgr, ZypperManager):
                if os.path.isdir("/etc/zypp/repos.d"):
                    for rf in os.listdir("/etc/zypp/repos.d"):
                        shutil.copy2(os.path.join("/etc/zypp/repos.d", rf), sources_dir)
                if os.path.exists("/etc/zypp/zypp.conf"):
                    shutil.copy2("/etc/zypp/zypp.conf", sources_dir)

            # Alpine Linux apk repositories
            if isinstance(pkg_mgr, ApkManager):
                if os.path.exists("/etc/apk/repositories"):
                    shutil.copy2("/etc/apk/repositories", sources_dir)
                if os.path.exists("/etc/apk/world"):
                    shutil.copy2("/etc/apk/world", sources_dir)

            # FreeBSD pkg configuration
            if isinstance(pkg_mgr, FreeBSDPkgManager):
                if os.path.exists("/usr/local/etc/pkg.conf"):
                    shutil.copy2("/usr/local/etc/pkg.conf", sources_dir)
                if os.path.isdir("/usr/local/etc/pkg/repos"):
                    for rf in os.listdir("/usr/local/etc/pkg/repos"):
                        shutil.copy2(
                            os.path.join("/usr/local/etc/pkg/repos", rf), sources_dir
                        )

        # Full system image (optional)
        image_size = 0
        if mode == "full_system":
            if IS_WINDOWS:
                try:
                    image_meta = _full_system_image(
                        name, snap_dir, windows_backup_target=windows_backup_target
                    )
                    image_size = int(image_meta.get("image_size_bytes") or 0)
                    result["details"]["image_path"] = image_meta.get("manifest_path")
                    result["details"]["image_size_bytes"] = image_size
                    if image_meta.get("backup_target"):
                        result["details"]["backup_target"] = image_meta["backup_target"]
                    if image_meta.get("version_identifier"):
                        result["details"]["version_identifier"] = image_meta[
                            "version_identifier"
                        ]
                except Exception as e:
                    fallback_enabled = (
                        os.getenv("PM_WINDOWS_FULL_SNAPSHOT_FALLBACK", "1") or "1"
                    ).strip() != "0"
                    if not fallback_enabled:
                        raise e
                    result["details"]["full_system_error"] = str(e)
                    result["details"]["fallback_mode"] = "packages"
                    result["details"]["warning"] = (
                        "Full-system image failed; snapshot saved in packages mode"
                    )
                    result["mode"] = "packages"
                    result["status"] = "degraded"
                    mode = "packages"
            else:
                image_size = _full_system_image(name, snap_dir)
                result["details"]["image_path"] = os.path.join(
                    snap_dir, "full_image.tar.gz"
                )
                result["details"]["image_size_bytes"] = image_size

        meta = {
            "name": name,
            "created": datetime.now().isoformat(),
            "packages_count": result["details"].get("packages_count", 0),
            "services_count": result["details"].get("services_count", 0),
            "mode": mode,
            "os": platform.system(),
            "image_size_bytes": image_size,
        }
        with open(os.path.join(snap_dir, "meta.json"), "w") as f:
            json.dump(meta, f, indent=2)
        result["success"] = True
        if result.get("status") == "running":
            result["status"] = "success"
        result["created"] = meta["created"]
        logger.info("Snapshot '%s' (%s) created for %s", name, mode, platform.system())
    except Exception as e:
        result["error"] = str(e)
        result["status"] = "failed"
        logger.error("Snapshot creation failed: %s", e)
    record_job({"type": "snapshot", **result})
    return result


def _restore_full_snapshot(meta, snap_dir):
    if IS_WINDOWS:
        manifest_path = _windows_backup_manifest_path(snap_dir)
        if not os.path.exists(manifest_path):
            return {
                "success": False,
                "error": "Windows full-system backup manifest not found",
            }
        try:
            return _restore_windows_backup_manifest(manifest_path)
        except Exception as e:
            return {"success": False, "error": str(e)}
    img_path = os.path.join(snap_dir, "full_image.tar.gz")
    if not os.path.exists(img_path):
        return {"success": False, "error": "Full image not found"}
    # Linux restore (dangerous): untar to /
    cmd = ["tar", "xzf", img_path, "-C", "/", "--numeric-owner", "--overwrite"]
    rc, out = run_cmd(cmd, timeout=7200)
    return {"success": rc == 0, "rc": rc, "output": out[:800]}


def _rollback_snapshot(name):
    snap_dir = os.path.join(SNAPSHOT_DIR, name)
    result = {"name": name, "success": False, "steps": []}
    if not os.path.isdir(snap_dir):
        result["error"] = f"Snapshot '{name}' not found"
        return result
    try:
        meta_path = os.path.join(snap_dir, "meta.json")
        meta = {}
        if os.path.exists(meta_path):
            with open(meta_path) as f:
                meta = json.load(f)
        if meta.get("mode") == "full_system":
            r = _restore_full_snapshot(meta, snap_dir)
            result["steps"].append(r)
            result["success"] = r.get("success", False)
            return result

        pkg_mgr.refresh()
        packages_file = os.path.join(snap_dir, "packages.json")
        if os.path.exists(packages_file):
            with open(packages_file) as f:
                old_pkgs = json.load(f)
            if IS_WINDOWS:
                current_pkgs = pkg_mgr.list_installed()
                desired = {
                    key: pkg
                    for pkg in old_pkgs
                    if (key := _windows_package_identity(pkg))
                }
                current = {
                    key: pkg
                    for pkg in current_pkgs
                    if (key := _windows_package_identity(pkg))
                }
                failures = 0
                warnings = []

                for key, desired_pkg in desired.items():
                    current_pkg = current.get(key)
                    if current_pkg and str(current_pkg.get("version") or "") == str(
                        desired_pkg.get("version") or ""
                    ):
                        continue
                    rc, out = _windows_install_snapshot_package(desired_pkg)
                    result["steps"].append(
                        {
                            "step": "reconcile-package",
                            "package": desired_pkg.get("id") or desired_pkg.get("name"),
                            "target_version": desired_pkg.get("version", ""),
                            "rc": rc,
                            "output": out[:500],
                        }
                    )
                    if rc != 0:
                        failures += 1

                for key, current_pkg in current.items():
                    if key in desired:
                        continue
                    rc, out = _windows_remove_snapshot_package(current_pkg)
                    result["steps"].append(
                        {
                            "step": "remove-extra-package",
                            "package": current_pkg.get("id") or current_pkg.get("name"),
                            "rc": rc,
                            "output": out[:500],
                        }
                    )
                    if rc != 0:
                        warnings.append(
                            f"Could not remove {current_pkg.get('id') or current_pkg.get('name')}"
                        )

                result["warnings"] = warnings
                result["success"] = failures == 0
                if failures:
                    result["error"] = (
                        f"{failures} Windows package rollback action(s) failed"
                    )
                return result
            # Build a list of "name=version" targets to downgrade/reinstall to snapshot state
            if isinstance(pkg_mgr, AptManager):
                targets = [
                    f"{p['name']}={p['version']}"
                    for p in old_pkgs
                    if p.get("name") and p.get("version")
                ]
                if targets:
                    # apt-get install with pinned versions will downgrade if needed
                    rc, out = run_cmd(
                        [
                            "apt-get",
                            "install",
                            "-y",
                            "--allow-downgrades",
                            "--no-install-recommends",
                        ]
                        + targets,
                        timeout=600,
                    )
                    result["steps"].append(
                        {"step": "downgrade-packages", "rc": rc, "output": out[:500]}
                    )
                    result["success"] = rc == 0
                else:
                    result["success"] = True
            elif isinstance(pkg_mgr, DnfManager):
                targets = [
                    f"{p['name']}-{p['version']}"
                    for p in old_pkgs
                    if p.get("name") and p.get("version")
                ]
                if targets:
                    rc, out = run_cmd(["dnf", "downgrade", "-y"] + targets, timeout=600)
                    result["steps"].append(
                        {"step": "downgrade-packages", "rc": rc, "output": out[:500]}
                    )
                    result["success"] = rc == 0
                else:
                    result["success"] = True
            else:
                result["error"] = "Rollback not supported for this package manager"
    except Exception as e:
        result["error"] = str(e)
    record_job({"type": "rollback", **result})
    return result


@app.route("/snapshot/create", methods=["POST"])
@_require_auth
def api_create_snapshot():
    data = request.get_json(silent=True) or {}
    mode = data.get("mode") or "packages"
    services = data.get("services") or []
    backup_target = data.get("backup_target")
    if isinstance(backup_target, str):
        backup_target = backup_target.strip()
    else:
        backup_target = None
    result = _create_snapshot(
        data.get("name"),
        mode=mode,
        selected_services=services,
        windows_backup_target=backup_target,
    )
    return jsonify(result), 200 if result["success"] else 500


@app.route("/snapshot/precheck", methods=["POST"])
@_require_auth
def api_snapshot_precheck():
    data = request.get_json(silent=True) or {}
    mode = data.get("mode") or "packages"
    backup_target = data.get("backup_target")
    if isinstance(backup_target, str):
        backup_target = backup_target.strip()
    else:
        backup_target = None
    result = _snapshot_precheck(mode=mode, windows_backup_target=backup_target)
    return jsonify(result), 200 if result.get("ok") else 400


@app.route("/snapshot/list", methods=["GET"])
def api_list_snapshots():
    snapshots = []
    if os.path.isdir(SNAPSHOT_DIR):
        for name in sorted(os.listdir(SNAPSHOT_DIR), reverse=True):
            meta_file = os.path.join(SNAPSHOT_DIR, name, "meta.json")
            if os.path.exists(meta_file):
                try:
                    with open(meta_file) as f:
                        meta = json.load(f)
                    # augment with size if image exists
                    img_path = os.path.join(SNAPSHOT_DIR, name, "full_image.vhdx")
                    if not os.path.exists(img_path):
                        img_path = os.path.join(SNAPSHOT_DIR, name, "full_image.tar.gz")
                    if os.path.exists(img_path):
                        meta["image_size_bytes"] = os.path.getsize(img_path)
                        meta["image_path"] = img_path
                    else:
                        manifest_path = _windows_backup_manifest_path(
                            os.path.join(SNAPSHOT_DIR, name)
                        )
                        if os.path.exists(manifest_path):
                            meta["image_size_bytes"] = os.path.getsize(manifest_path)
                            meta["image_path"] = manifest_path
                    snapshots.append(meta)
                except Exception:
                    snapshots.append({"name": name, "created": "unknown"})
            else:
                snapshots.append({"name": name, "created": "unknown"})
    return jsonify({"snapshots": snapshots, "count": len(snapshots)})


def _safe_snapshot_name(name):
    """Validate snapshot name to prevent path traversal."""
    if not name or not isinstance(name, str):
        return None
    safe = os.path.basename(name)
    if not safe or safe.startswith(".") or "/" in name or "\\" in name:
        return None
    return safe


@app.route("/snapshot/rollback", methods=["POST"])
@_require_auth
def api_rollback_snapshot():
    data = request.get_json(silent=True) or {}
    # Accept either 'name' directly or 'ref_job_id' (sent by backend rollback endpoint)
    name = data.get("name") or data.get("ref_job_id")
    name = _safe_snapshot_name(str(name)) if name else None
    if not name:
        return jsonify({"error": "valid snapshot name or ref_job_id required"}), 400
    result = _rollback_snapshot(name)
    return jsonify(result), 200 if result["success"] else 500


@app.route("/snapshot/delete", methods=["POST"])
@_require_auth
def api_delete_snapshot():
    data = request.get_json(silent=True) or {}
    name = _safe_snapshot_name(data.get("name"))
    if not name:
        return jsonify({"error": "valid snapshot name required"}), 400
    snap_dir = os.path.join(SNAPSHOT_DIR, name)
    if not os.path.realpath(snap_dir).startswith(os.path.realpath(SNAPSHOT_DIR)):
        return jsonify({"error": "invalid snapshot name"}), 400
    if os.path.isdir(snap_dir):
        shutil.rmtree(snap_dir)
        return jsonify({"deleted": True, "name": name})
    return jsonify({"error": "snapshot not found"}), 404


# === PATCH EXECUTION with snapshot + rollback ===


def _run_patch_task(
    packages,
    hold,
    dry_run,
    auto_snapshot,
    auto_rollback,
    security_only=False,
    exclude_kernel=False,
    auto_reboot=False,
    pre_patch_script=None,
    post_patch_script=None,
    extra_flags=None,
):
    patch_gauge.set(1)
    result = {
        "success": False,
        "snapshot": None,
        "patch_output": "",
        "rollback": None,
        "dry_run": dry_run,
        "reboot_required": False,
        "pre_script_output": "",
        "post_script_output": "",
        "verification": {},
    }
    try:
        # Pre-patch script
        if pre_patch_script and not dry_run:
            rc_pre, out_pre = run_cmd(["bash", "-c", pre_patch_script], timeout=120)
            result["pre_script_output"] = out_pre
            if rc_pre != 0:
                result["error"] = (
                    f"Pre-patch script failed (rc={rc_pre}): {out_pre[:500]}"
                )
                patch_gauge.set(3)
                return result

        if auto_snapshot and not dry_run:
            snap_result = _create_snapshot(
                f"pre-patch-{int(time.time())}-{uuid.uuid4().hex[:8]}"
            )
            result["snapshot"] = snap_result

        # Hold packages (Apt only for now)
        if hasattr(pkg_mgr, "hold"):
            for pkg in hold:
                run_cmd(["apt-mark", "hold", pkg])

        # Capture versions before patch for verification
        before_versions = {}
        if packages and not dry_run:
            for pkg in packages:
                installed = pkg_mgr.list_installed()
                match = next((p for p in installed if p["name"] == pkg), None)
                if match:
                    before_versions[pkg] = match.get("version", "")

        pkg_mgr.refresh()
        rc, out = pkg_mgr.install(
            packages,
            security_only=security_only,
            exclude_kernel=exclude_kernel,
            extra_flags=extra_flags or [],
        )
        result["patch_output"] += out
        patch_success = rc == 0

        if hasattr(pkg_mgr, "unhold"):
            for pkg in hold:
                run_cmd(["apt-mark", "unhold", pkg])

        # Post-patch verification: check versions changed
        if patch_success and packages and not dry_run:
            after_installed = pkg_mgr.list_installed()
            after_map = {p["name"]: p.get("version", "") for p in after_installed}
            verification = {}
            for pkg in packages:
                before = before_versions.get(pkg, "")
                after = after_map.get(pkg, "")
                verification[pkg] = {
                    "before": before,
                    "after": after,
                    "updated": bool(after and after != before),
                }
            result["verification"] = verification

        if not patch_success and auto_rollback and not dry_run:
            if result.get("snapshot", {}).get("success"):
                rb = _rollback_snapshot(result["snapshot"]["name"])
                result["rollback"] = rb
                record_job(
                    {
                        "type": "patch_rollback",
                        "patch_snapshot": result["snapshot"]["name"],
                        **rb,
                    }
                )

        result["success"] = patch_success
        patch_gauge.set(2 if patch_success else 3)
        if patch_success:
            last_patch_ts.set(time.time())

        # Post-patch script
        if post_patch_script and patch_success and not dry_run:
            rc_post, out_post = run_cmd(["bash", "-c", post_patch_script], timeout=120)
            result["post_script_output"] = out_post

        # Reboot check
        checker = getattr(pkg_mgr, "check_reboot", None)
        if callable(checker):
            result["reboot_required"] = bool(checker())
        if result["reboot_required"] and auto_reboot and patch_success and not dry_run:
            result["reboot_scheduled"] = True
            threading.Timer(
                10.0,
                lambda: run_cmd(
                    ["shutdown", "/r", "/t", "30"]
                    if IS_WINDOWS
                    else ["shutdown", "-r", "+1"]
                ),
            ).start()

    except Exception as e:
        result["error"] = str(e)
        patch_gauge.set(3)
    return result


@app.route("/patch/execute", methods=["POST"])
@_require_auth
def execute_patch():
    data = request.get_json(silent=True) or {}
    _valid_pkg = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9.+\-_]+$")
    packages = [
        p.strip()
        for p in data.get("packages", [])
        if isinstance(p, str) and _valid_pkg.match(p.strip())
    ]
    hold = [
        h.strip()
        for h in data.get("hold", [])
        if isinstance(h, str) and _valid_pkg.match(h.strip())
    ]
    dry_run = data.get("dry_run", False)
    auto_snapshot = data.get("auto_snapshot", True)
    auto_rollback = data.get("auto_rollback", True)
    security_only = bool(data.get("security_only", False))
    exclude_kernel = bool(data.get("exclude_kernel", False))
    auto_reboot = bool(data.get("auto_reboot", False))
    pre_patch_script = str(data.get("pre_patch_script") or "").strip() or None
    post_patch_script = str(data.get("post_patch_script") or "").strip() or None
    extra_flags = [
        str(f)
        for f in (data.get("extra_flags") or [])
        if isinstance(f, str) and f.strip().startswith("-")
    ]

    ok, msg = run_async_job(
        "patch",
        _run_patch_task,
        packages,
        hold,
        dry_run,
        auto_snapshot,
        auto_rollback,
        security_only,
        exclude_kernel,
        auto_reboot,
        pre_patch_script,
        post_patch_script,
        extra_flags,
    )
    if not ok:
        return jsonify({"error": msg}), 409
    return jsonify({"status": "started", "job": "patch"})


# === OFFLINE PATCHING ===


@app.route("/offline/upload", methods=["POST"])
@_require_auth
def offline_upload():
    try:
        files = request.files.getlist("file")
        if not files:
            logger.warning("offline_upload: no files provided in request")
            return jsonify({"error": "no files provided"}), 400

        # Ensure OFFLINE_DIR exists
        os.makedirs(OFFLINE_DIR, exist_ok=True)

        saved = []
        # Support .deb, .rpm, .msi, .exe
        valid_exts = (".deb", ".rpm", ".msi", ".exe")
        for f in files:
            if not f.filename or not any(
                f.filename.lower().endswith(ext) for ext in valid_exts
            ):
                logger.warning(f"offline_upload: skipping invalid file {f.filename}")
                continue
            safe_name = os.path.basename(f.filename)
            dest = os.path.join(OFFLINE_DIR, safe_name)
            if not os.path.realpath(dest).startswith(os.path.realpath(OFFLINE_DIR)):
                logger.warning(
                    f"offline_upload: path traversal attempt blocked for {safe_name}"
                )
                continue
            try:
                f.save(dest)
                saved.append(safe_name)
                logger.info(
                    f"offline_upload: saved {safe_name} ({os.path.getsize(dest)} bytes)"
                )
            except Exception as save_err:
                logger.error(f"offline_upload: failed to save {safe_name}: {save_err}")
                continue

        logger.info(
            f"offline_upload: successfully saved {len(saved)} file(s) to {OFFLINE_DIR}"
        )
        return jsonify({"uploaded": saved, "count": len(saved), "path": OFFLINE_DIR})
    except Exception as e:
        logger.error(f"offline_upload: unexpected error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route("/offline/list", methods=["GET"])
def offline_list():
    pkgs = []
    if os.path.isdir(OFFLINE_DIR):
        for f in sorted(os.listdir(OFFLINE_DIR)):
            fpath = os.path.join(OFFLINE_DIR, f)
            pkgs.append(
                {
                    "name": f,
                    "size": os.path.getsize(fpath),
                    "size_mb": round(os.path.getsize(fpath) / 1048576, 2),
                }
            )
    return jsonify({"pkgs": pkgs, "count": len(pkgs)})


def _run_offline_task(
    pkg_files, auto_snapshot, auto_rollback, auto_reboot=False, post_patch_script=None
):
    patch_gauge.set(1)
    result = {
        "success": False,
        "snapshot": None,
        "install_output": "",
        "rollback": None,
        "files": [os.path.basename(f) for f in pkg_files],
        "reboot_required": False,
        "post_script_output": "",
    }
    try:
        if auto_snapshot:
            snap = _create_snapshot(
                f"pre-offline-{int(time.time())}-{uuid.uuid4().hex[:8]}"
            )
            result["snapshot"] = snap

        rc, out = pkg_mgr.install(pkg_files, local=True)
        result["install_output"] += out

        patch_success = rc == 0
        if not patch_success and auto_rollback:
            if result.get("snapshot", {}).get("success"):
                rb = _rollback_snapshot(result["snapshot"]["name"])
                result["rollback"] = rb

        result["success"] = patch_success
        patch_gauge.set(2 if patch_success else 3)
        if patch_success:
            last_patch_ts.set(time.time())

        # Post-install script
        if post_patch_script and patch_success:
            rc_post, out_post = run_cmd(["bash", "-c", post_patch_script], timeout=120)
            result["post_script_output"] = out_post

        # Reboot check
        checker = getattr(pkg_mgr, "check_reboot", None)
        if callable(checker):
            result["reboot_required"] = bool(checker())
        if result["reboot_required"] and auto_reboot and patch_success:
            result["reboot_scheduled"] = True
            threading.Timer(
                10.0,
                lambda: run_cmd(
                    ["shutdown", "/r", "/t", "30"]
                    if IS_WINDOWS
                    else ["shutdown", "-r", "+1"]
                ),
            ).start()

    except Exception as e:
        result["error"] = str(e)
        patch_gauge.set(3)
    return result


@app.route("/offline/install", methods=["POST"])
@_require_auth
def offline_install():
    data = request.get_json(silent=True) or {}
    auto_snapshot = data.get("auto_snapshot", True)
    auto_rollback = data.get("auto_rollback", True)
    auto_reboot = bool(data.get("auto_reboot", False))
    post_patch_script = str(data.get("post_patch_script") or "").strip() or None
    selected = data.get("files", [])

    pkg_files = []
    if selected:
        for f in selected:
            safe = os.path.basename(f)
            full = os.path.join(OFFLINE_DIR, safe)
            if os.path.exists(full) and os.path.realpath(full).startswith(
                os.path.realpath(OFFLINE_DIR)
            ):
                pkg_files.append(full)
    else:
        for ext in ("*.deb", "*.rpm", "*.msi", "*.exe"):
            pkg_files.extend(glob.glob(os.path.join(OFFLINE_DIR, ext)))

    if not pkg_files:
        return jsonify({"error": "no package files found"}), 400

    ok, msg = run_async_job(
        "offline_install",
        _run_offline_task,
        pkg_files,
        auto_snapshot,
        auto_rollback,
        auto_reboot,
        post_patch_script,
    )
    if not ok:
        return jsonify({"error": msg}), 409
    return jsonify({"status": "started", "job": "offline_install"})


@app.route("/offline/clear", methods=["POST"])
@_require_auth
def offline_clear():
    removed = []
    for ext in ("*.deb", "*.rpm", "*.msi", "*.exe"):
        for f in glob.glob(os.path.join(OFFLINE_DIR, ext)):
            os.remove(f)
            removed.append(os.path.basename(f))
    return jsonify({"cleared": removed, "count": len(removed)})


# === BASIC ROUTES ===


@app.route("/status")
def status():
    return jsonify(JOB_STATUS)


@app.route("/job/history")
def job_history():
    jobs = []
    log_file = os.path.join(LOG_DIR, "jobs.jsonl")
    if os.path.exists(log_file):
        try:
            with open(log_file, "r") as f:
                for line in f:
                    try:
                        jobs.append(json.loads(line))
                    except (json.JSONDecodeError, ValueError):
                        # Skip malformed JSON lines
                        pass
        except (IOError, OSError):
            # Log file may be locked or inaccessible
            pass
    return jsonify({"history": jobs[-100:][::-1]})


@app.route("/history")
def history_alias():
    return job_history()


@app.route("/snapshot/archive/<name>", methods=["GET"])
@_require_auth
def archive_snapshot(name):
    """Zip a snapshot directory and return it."""
    safe_name = _safe_snapshot_name(name)
    if not safe_name:
        return jsonify({"error": "Invalid name"}), 400

    snap_dir = os.path.join(SNAPSHOT_DIR, safe_name)
    if not os.path.isdir(snap_dir):
        return jsonify({"error": "Not found"}), 404

    zip_path = os.path.join(LOG_DIR, f"{safe_name}.zip")
    try:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(snap_dir):
                for file in files:
                    zipf.write(
                        os.path.join(root, file),
                        os.path.relpath(
                            os.path.join(root, file), os.path.join(snap_dir, "..")
                        ),
                    )
        return send_file(zip_path, as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/snapshot/restore_upload", methods=["POST"])
@_require_auth
def restore_upload():
    """Upload a snapshot zip and restore it."""
    if "file" not in request.files:
        return jsonify({"error": "file required"}), 400
    f = request.files["file"]
    name = request.form.get("name") or Path(secure_filename(f.filename)).stem
    safe_name = _safe_snapshot_name(name)
    if not safe_name:
        return jsonify({"error": "Invalid snapshot name"}), 400
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".zip")
    os.close(tmp_fd)
    f.save(tmp_path)
    snap_dir = os.path.join(SNAPSHOT_DIR, safe_name)
    os.makedirs(snap_dir, exist_ok=True)
    try:
        with zipfile.ZipFile(tmp_path, "r") as zip_ref:
            _safe_extract_zip(zip_ref, os.path.join(SNAPSHOT_DIR))
        res = _rollback_snapshot(safe_name)
    except Exception as e:
        res = {"success": False, "error": str(e)}
    finally:
        os.remove(tmp_path)
    return jsonify(res), 200 if res.get("success") else 500


@app.route("/snapshot/restore_url", methods=["POST"])
@_require_auth
def restore_url():
    data = request.get_json(silent=True) or {}
    url = data.get("url")
    name = data.get("name")
    if not url:
        return jsonify({"error": "url required"}), 400
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".zip")
    os.close(tmp_fd)
    try:
        urllib.request.urlretrieve(url, tmp_path)
        if not name:
            name = Path(url).stem or f"imported-{int(time.time())}"
        safe_name = _safe_snapshot_name(name)
        if not safe_name:
            return jsonify({"error": "Invalid name"}), 400
        snap_dir = os.path.join(SNAPSHOT_DIR, safe_name)
        os.makedirs(snap_dir, exist_ok=True)
        with zipfile.ZipFile(tmp_path, "r") as zip_ref:
            _safe_extract_zip(zip_ref, os.path.join(SNAPSHOT_DIR))
        res = _rollback_snapshot(safe_name)
        return jsonify(res), 200 if res.get("success") else 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            # File may have already been deleted or is in use
            pass


@app.route("/cleanup", methods=["POST"])
@_require_auth
def cleanup_resources():
    """Delete old snapshots and offline packages."""
    data = request.get_json(silent=True) or {}
    snap_days = data.get("snapshot_retention_days", 30)
    pkg_days = data.get("package_retention_days", 30)

    deleted_snaps = []
    deleted_pkgs = []
    now = time.time()

    # Clean snapshots
    if os.path.isdir(SNAPSHOT_DIR):
        for d in os.listdir(SNAPSHOT_DIR):
            path = os.path.join(SNAPSHOT_DIR, d)
            if os.path.isdir(path):
                if os.path.getmtime(path) < now - (snap_days * 86400):
                    shutil.rmtree(path)
                    deleted_snaps.append(d)

    # Clean offline packages
    if os.path.isdir(OFFLINE_DIR):
        for f in os.listdir(OFFLINE_DIR):
            path = os.path.join(OFFLINE_DIR, f)
            if os.path.isfile(path):
                if os.path.getmtime(path) < now - (pkg_days * 86400):
                    os.remove(path)
                    deleted_pkgs.append(f)

    return jsonify(
        {
            "deleted_snapshots": deleted_snaps,
            "deleted_packages": deleted_pkgs,
            "status": "success",
        }
    )


@app.route("/devops/run", methods=["POST"])
@_require_auth
def devops_run():
    """Run DevOps workflow from YAML definition."""
    data = request.get_json(silent=True) or {}
    yaml_content = data.get("yaml")
    if not yaml_content:
        return jsonify({"error": "No YAML provided"}), 400
    try:
        workflow = yaml.safe_load(yaml_content)
    except Exception as e:
        return jsonify({"error": f"YAML parse error: {e}"}), 400
    # Example: run steps defined in YAML
    results = []
    for step in workflow.get("steps", []):
        cmd = step.get("run")
        if cmd:
            # Wrap string commands in a shell so pipes/redirects work
            if IS_WINDOWS:
                shell_cmd = ["cmd.exe", "/c", cmd]
            else:
                shell_cmd = ["bash", "-c", cmd]
            rc, out = run_cmd(shell_cmd, timeout=step.get("timeout", 600))
            results.append({"step": step.get("name", cmd), "rc": rc, "output": out})
    return jsonify({"results": results})


# === BACKUP FEATURES ===


def backup_database(db_type, connection_string, output_file):
    logger.info(f"Backing up database {db_type} to {output_file}")

    if db_type == "postgres":
        cmd = ["pg_dump", "--format=c", "--file", output_file, connection_string]
        rc, out = run_cmd(cmd)
        if rc != 0:
            raise Exception(f"pg_dump failed: {out}")

    elif db_type == "mysql":
        # Parse the connection string into argv elements (same pattern as redis above).
        # Supports both DSN-style flags ("--host=db --user=root mydb") and a bare
        # database name.  shlex.split preserves quoted values and avoids shell=True.
        import shlex

        conn_args = shlex.split(connection_string) if connection_string else []
        with open(output_file, "wb") as out_fh:
            process = subprocess.run(
                ["mysqldump"] + conn_args,
                stdout=out_fh,
                stderr=subprocess.PIPE,
            )
        if process.returncode != 0:
            raise Exception(
                f"mysqldump failed: {process.stderr.decode(errors='replace')}"
            )

    elif db_type == "mongodb":
        cmd = ["mongodump", f"--uri={connection_string}", f"--archive={output_file}"]
        rc, out = run_cmd(cmd)
        if rc != 0:
            raise Exception(f"mongodump failed: {out}")

    elif db_type == "redis":
        # Redis RDB backup
        # connection_string expected as extra cli args e.g. '-h HOST -p PORT -a PASS' or empty for local
        import shlex

        extra_args = shlex.split(connection_string) if connection_string else []
        cmd = ["redis-cli"] + extra_args + ["--rdb", output_file]
        rc, out = run_cmd(cmd)
        if rc != 0:
            raise Exception(f"redis backup failed: {out}")

    elif db_type == "sqlite":
        # connection_string is the path to the sqlite file
        if not os.path.exists(connection_string):
            raise FileNotFoundError(f"SQLite DB not found: {connection_string}")
        shutil.copy2(connection_string, output_file)

    else:
        raise ValueError(f"Unsupported database type: {db_type}")

    return output_file


def backup_files(source_path, output_file):
    logger.info(f"Backing up files from {source_path} to {output_file}")
    if os.path.isdir(source_path):
        base_name = output_file.replace(".zip", "")
        shutil.make_archive(base_name, "zip", source_path)
        final_path = base_name + ".zip"
        if final_path != output_file and os.path.exists(final_path):
            if os.path.exists(output_file):
                os.remove(output_file)
            shutil.move(final_path, output_file)
    elif os.path.isfile(source_path):
        shutil.copy2(source_path, output_file)
    else:
        raise FileNotFoundError(f"Source path {source_path} not found")
    return output_file


def backup_vm(vm_name, output_file):
    logger.info(f"VM Backup requested for {vm_name}")
    # Real implementation would interface with VBoxManage, virsh, or Hyper-V
    # Here we mock it but add capability check

    # Example: Check for VBoxManage
    if shutil.which("VBoxManage"):
        # cmd = ["VBoxManage", "snapshot", vm_name, "take", f"backup_{int(time.time())}"]
        # run_cmd(cmd)
        pass

    with open(output_file, "w") as f:
        f.write(f"VM Backup Metadata for {vm_name} at {datetime.now()}\n")
        f.write("Status: Success (Mock)\n")
    return output_file


def backup_live(source_path, output_file):
    if IS_WINDOWS:
        # Use list form to avoid shell=True injection on source/destination
        cmd = ["robocopy", source_path, output_file, "/MIR", "/R:0", "/W:0"]
        proc = subprocess.run(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
        )
        # robocopy exit codes 0-7 are success/informational; 8+ indicate errors
        if proc.returncode >= 8:
            raise Exception(
                f"robocopy failed (rc={proc.returncode}): {proc.stdout[:400]}"
            )
    else:
        src = source_path if source_path.endswith("/") else source_path + "/"
        dst = output_file if output_file.endswith("/") else output_file + "/"
        # Use rsync for efficient live sync
        cmd = ["rsync", "-av", "--update", "--delete", src, dst]
        rc, out = run_cmd(cmd)
        if rc != 0:
            raise Exception(f"rsync failed: {out}")
    return output_file


def backup_full_system(output_file):
    """Create a full system image (Linux only, root required)."""
    if IS_WINDOWS:
        target = _resolve_windows_backup_target()
        if not target:
            raise Exception(
                "No writable backup target available for Windows full-system backup"
            )
        versions_before = set(_detect_wbadmin_versions(target))
        rc, out = run_cmd(
            [
                "wbadmin",
                "start",
                "backup",
                f"-backupTarget:{target}",
                "-allCritical",
                "-quiet",
            ],
            timeout=7200,
        )
        if rc != 0:
            raise Exception(f"wbadmin failed: {out[:400]}")
        versions_after = _detect_wbadmin_versions(target)
        version_identifier = next(
            (v for v in versions_after if v not in versions_before),
            versions_after[0] if versions_after else "",
        )
        os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
        _write_windows_backup_manifest(
            output_file,
            target,
            version_identifier=version_identifier,
            command_output=out,
            backup_mode="full_system",
        )
        return output_file

    # DD backup of root partition (DANGEROUS - Mocking for safety)
    # cmd = f"dd if=/dev/sda of={output_file} bs=4M status=progress"

    # Safer alternative: Tarball of root with excludes
    cmd = [
        "tar",
        "czf",
        output_file,
        "--exclude=/proc",
        "--exclude=/sys",
        "--exclude=/dev",
        "--exclude=/tmp",
        "--exclude=/run",
        "--exclude=/mnt",
        "--exclude=/media",
        "--exclude=/lost+found",
        "/",
    ]
    rc, out = run_cmd(cmd, timeout=7200)  # 2 hours timeout
    if rc != 0:
        raise Exception(f"Full system backup failed: {out}")
    return output_file


@app.route("/backup/trigger", methods=["POST"])
@_require_auth
def trigger_backup():
    data = request.get_json(silent=True) or {}
    b_type = data.get("type")
    log_id = data.get("log_id")

    # Input Sanitization
    allowed_types = ["database", "file", "vm", "live", "full_system"]
    if b_type not in allowed_types:
        return jsonify({"status": "error", "message": "Invalid backup type"}), 400

    source = data.get("source")
    dest = data.get("destination")
    db_type = data.get("db_type")

    # Async Execution Wrapper
    def run_backup_task(data, dest):
        started_at = time.time()
        try:
            # Retention Policy
            retention_count = data.get("retention_count", 5)
            # Find old backups of SAME type and prefix
            prefix = f"backup_{b_type}_"
            backups = sorted(
                [
                    os.path.join(SNAPSHOT_DIR, f)
                    for f in os.listdir(SNAPSHOT_DIR)
                    if f.startswith(prefix)
                ]
            )
            while len(backups) >= retention_count:
                oldest = backups.pop(0)
                try:
                    if os.path.isdir(oldest):
                        shutil.rmtree(oldest)
                    else:
                        os.remove(oldest)
                    logger.info(f"Retention: Deleted old backup {oldest}")
                except Exception as e:
                    logger.error(f"Failed to delete old backup {oldest}: {e}")

            if b_type == "database":
                backup_database(db_type, source, dest)
            elif b_type == "file":
                backup_files(source, dest)
            elif b_type == "vm":
                backup_vm(source, dest)
            elif b_type == "live":
                backup_live(source, dest)
            elif b_type == "full_system":
                backup_full_system(dest)

            # Encryption (Optional)
            enc_key = data.get("encryption_key")
            if enc_key and b_type != "live":
                enc_dest = dest + ".enc"
                cmd = [
                    "openssl",
                    "enc",
                    "-aes-256-cbc",
                    "-salt",
                    "-pbkdf2",
                    "-in",
                    dest,
                    "-out",
                    enc_dest,
                    "-k",
                    enc_key,
                ]
                rc, out = run_cmd(cmd)
                if rc == 0:
                    os.remove(dest)
                    dest = enc_dest
                else:
                    logger.error(f"Encryption failed: {out}")
                    raise Exception(f"Encryption failed: {out}")

            logger.info(f"Backup completed successfully: {dest}")
            _report_backup_result(
                log_id=log_id,
                status="success",
                output_file=dest,
                duration_seconds=max(time.time() - started_at, 0.0),
                file_size_bytes=_path_size_bytes(dest),
            )
        except Exception as e:
            logger.error(f"Backup job failed: {e}")
            _report_backup_result(
                log_id=log_id,
                status="failed",
                output_file=dest,
                duration_seconds=max(time.time() - started_at, 0.0),
                file_size_bytes=_path_size_bytes(dest),
                message=str(e),
            )

    if not dest:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        if not os.path.exists(SNAPSHOT_DIR):
            os.makedirs(SNAPSHOT_DIR)
        dest = os.path.join(SNAPSHOT_DIR, f"backup_{b_type}_{ts}")
        if b_type == "file":
            dest += ".zip"
        if b_type == "database":
            dest += ".dump"
        if b_type == "vm":
            dest += ".img"
        if b_type == "full_system":
            dest += ".json" if IS_WINDOWS else ".tar.gz"

    # Start in background thread
    threading.Thread(target=run_backup_task, args=(data, dest), daemon=True).start()

    return jsonify(
        {
            "status": "started",
            "output_file": dest,
            "message": "Backup job started in background",
        }
    )


@app.route("/backup/restore", methods=["POST"])
@_require_auth
def restore_backup():
    """Restore a backup file to a target path.

    Accepts JSON body:
      - source_path: path to the backup file/directory on this host
      - target_path: destination path to restore to (defaults to source_path from config)
      - backup_type: 'file', 'database', 'live', etc. (optional, inferred from extension)
    """
    data = request.get_json(silent=True) or {}
    source_path = data.get("source_path") or data.get("storage_path") or ""
    target_path = data.get("target_path") or source_path

    if not source_path:
        return jsonify({"error": "source_path is required"}), 400

    manifest, manifest_path = (
        _resolve_windows_restore_manifest(source_path) if IS_WINDOWS else (None, None)
    )

    # Restore is a privileged backend-mediated operation. Accept only local,
    # absolute filesystem paths and let archive extraction safety enforce that
    # members stay under the chosen target root.
    for label, path_value in (("source_path", source_path),):
        if "://" in path_value:
            return jsonify({"error": f"{label} must be a local filesystem path"}), 400
        if not os.path.isabs(path_value):
            return jsonify({"error": f"{label} must be an absolute path"}), 400

    if not os.path.exists(source_path):
        return jsonify({"error": f"source_path not found: {source_path}"}), 404

    try:
        if manifest:
            backup_target_override = (
                str(data.get("backup_target") or "").strip() or None
            )
            if backup_target_override and "://" in backup_target_override:
                return jsonify(
                    {"error": "backup_target must be a local drive letter or UNC path"}
                ), 400
            result = _restore_windows_backup_manifest(
                manifest_path, target_override=backup_target_override
            )
            if not result.get("success"):
                return jsonify(result), 500
            logger.info("Windows backup restore completed from %s", source_path)
            return jsonify(
                {
                    "status": "success",
                    "source": source_path,
                    "backup_target": result.get("backup_target"),
                    "version": result.get("version"),
                    "attempts": result.get("attempts", []),
                }
            )

        if "://" in target_path:
            return jsonify(
                {"error": "target_path must be a local filesystem path"}
            ), 400
        if not os.path.isabs(target_path):
            return jsonify({"error": "target_path must be an absolute path"}), 400

        if os.path.isdir(source_path):
            if os.path.exists(target_path):
                if os.path.isdir(target_path):
                    shutil.rmtree(target_path)
                else:
                    os.remove(target_path)
            shutil.copytree(source_path, target_path)
        elif source_path.endswith(".zip"):
            os.makedirs(target_path, exist_ok=True)
            with zipfile.ZipFile(source_path, "r") as zf:
                _safe_extract_zip(zf, target_path)
        elif source_path.endswith((".tar.gz", ".tgz")):
            os.makedirs(target_path, exist_ok=True)
            with tarfile.open(source_path, "r:gz") as tf:
                _safe_extract_tar(tf, target_path)
        else:
            os.makedirs(os.path.dirname(os.path.abspath(target_path)), exist_ok=True)
            shutil.copy2(source_path, target_path)

        logger.info(f"Restore completed: {source_path} -> {target_path}")
        return jsonify(
            {"status": "success", "source": source_path, "target": target_path}
        )
    except Exception as e:
        logger.error(f"Restore failed: {e}")
        return jsonify({"error": str(e)}), 500


# === DEVOPS & POLICY ENGINE ===


def apply_service_state(service, state, enable=None):
    """Ensure a service is in the desired state."""
    logger.info(f"Policy: Ensuring service '{service}' is {state}")

    # Check current status
    is_running = False
    if IS_WINDOWS:
        # Check via sc query or powershell
        # PowerShell is more reliable for 'status'
        cmd = [
            "powershell",
            "-Command",
            f"Get-Service -Name {service} | Select-Object -ExpandProperty Status",
        ]
        rc, out = run_cmd(cmd)
        is_running = "Running" in out
    else:
        # Systemd
        cmd = ["systemctl", "is-active", service]
        rc, out = run_cmd(cmd)
        is_running = rc == 0

    # Apply state
    if state == "running" and not is_running:
        if IS_WINDOWS:
            run_cmd(["net", "start", service])
        else:
            run_cmd(["systemctl", "start", service])
    elif state == "stopped" and is_running:
        if IS_WINDOWS:
            run_cmd(["net", "stop", service])
        else:
            run_cmd(["systemctl", "stop", service])
    elif state == "restarted":
        if IS_WINDOWS:
            run_cmd(["net", "stop", service])
            run_cmd(["net", "start", service])
        else:
            run_cmd(["systemctl", "restart", service])

    # Apply enable/disable
    if enable is not None:
        if IS_WINDOWS:
            mode = "auto" if enable else "disabled"
            run_cmd(["sc", "config", service, f"start={mode}"])
        else:
            action = "enable" if enable else "disable"
            run_cmd(["systemctl", action, service])


def apply_file_state(path, content=None, state="present", mode=None):
    """Ensure a file exists with specific content/permissions."""
    logger.info(f"Policy: File '{path}' -> {state}")

    if state == "absent":
        if os.path.exists(path):
            os.remove(path)
    elif state == "present":
        if content is not None:
            with open(path, "w") as f:
                f.write(content)
        elif not os.path.exists(path):
            # Create empty file if content not specified but present required
            open(path, "a").close()

        if mode and not IS_WINDOWS:
            # Mode like "0644"
            try:
                os.chmod(path, int(mode, 8))
            except Exception as e:
                logger.warning(f"Failed to chmod {path}: {e}")


def run_script_step(script, shell="bash"):
    """Run a custom script block."""
    logger.info(f"Policy: Running script ({shell})")

    if IS_WINDOWS and shell == "bash":
        shell = "powershell"  # Fallback

    suffix = ".ps1" if shell == "powershell" else ".sh"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False, mode="w") as f:
        f.write(script)
        script_path = f.name

    try:
        if shell == "powershell":
            cmd = ["powershell", "-ExecutionPolicy", "Bypass", "-File", script_path]
        else:
            cmd = [shell, script_path]
            os.chmod(script_path, 0o755)

        rc, out = run_cmd(cmd)
        if rc != 0:
            raise Exception(f"Script failed (rc={rc}): {out}")
        return out
    finally:
        if os.path.exists(script_path):
            os.remove(script_path)


@app.route("/policy/apply", methods=["POST"])
@_require_auth
def apply_policy():
    """Apply a YAML-based configuration policy."""
    data = request.get_json(silent=True) or {}
    policy_yaml = data.get("policy")

    if not policy_yaml:
        return jsonify({"status": "error", "message": "No policy provided"}), 400

    try:
        import yaml

        policy = yaml.safe_load(policy_yaml)
        name = policy.get("name", "Unknown Policy")
        steps = policy.get("steps", [])
        results = []

        logger.info(f"Applying Policy: {name}")

        for step in steps:
            step_name = step.get("name", "Unnamed Step")
            module = step.get("module")
            try:
                if module == "service":
                    apply_service_state(
                        step.get("service"),
                        step.get("state", "running"),
                        step.get("enable"),
                    )
                elif module == "file":
                    apply_file_state(
                        step.get("path"),
                        step.get("content"),
                        step.get("state", "present"),
                        step.get("mode"),
                    )
                elif module == "script":
                    out = run_script_step(
                        step.get("run") or step.get("script"), step.get("shell", "bash")
                    )
                    results.append(
                        {"step": step_name, "status": "success", "output": out}
                    )
                    continue  # Skip default success append
                elif module == "package":
                    # Re-use existing package manager logic?
                    pkg = step.get("package")
                    state = step.get("state", "installed")
                    if state == "installed":
                        # Simple install wrapper
                        if IS_WINDOWS:
                            run_cmd(
                                ["winget", "install", "-e", "--id", pkg]
                            )  # simplistic
                        else:
                            if shutil.which("apt-get"):
                                run_cmd(["apt-get", "install", "-y", pkg])
                            elif shutil.which("yum"):
                                run_cmd(["yum", "install", "-y", pkg])
                    elif state == "absent":
                        if IS_WINDOWS:
                            run_cmd(["winget", "uninstall", "-e", "--id", pkg])
                        else:
                            if shutil.which("apt-get"):
                                run_cmd(["apt-get", "remove", "-y", pkg])
                            elif shutil.which("yum"):
                                run_cmd(["yum", "remove", "-y", pkg])

                results.append({"step": step_name, "status": "success"})
            except Exception as e:
                logger.error(f"Step '{step_name}' failed: {e}")
                results.append({"step": step_name, "status": "failed", "error": str(e)})
                if step.get("ignore_errors") is not True:
                    return jsonify(
                        {
                            "status": "failed",
                            "step": step_name,
                            "error": str(e),
                            "results": results,
                        }
                    ), 500

        return jsonify({"status": "success", "results": results})

    except Exception as e:
        logger.error(f"Policy application failed: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# === LIVE COMMAND RUNNER ===

_BLOCKED_CMDS = re.compile(
    r"\b(rm\s+-rf\s+/|mkfs|dd\s+if=|:(){ :|:&};:|shutdown|halt|poweroff|init\s+0)\b",
    re.IGNORECASE,
)


@app.route("/run", methods=["POST"])
@_require_auth
def run_command():
    """Execute an ad-hoc shell command. Blocks destructive patterns.

    Accepts optional 'working_dir' to set the cwd for the command.
    'cd /some/path' commands are handled by updating the working_dir
    in the response so the caller can track state client-side.
    """
    data = request.get_json(silent=True) or {}
    cmd = (data.get("command") or "").strip()
    timeout = int(data.get("timeout") or 30)
    working_dir = (data.get("working_dir") or "").strip() or None

    if not cmd:
        return jsonify({"error": "command required"}), 400
    if _BLOCKED_CMDS.search(cmd):
        return jsonify(
            {"error": "Command blocked: contains potentially destructive operation"}
        ), 400
    if timeout < 1 or timeout > 300:
        timeout = 30

    # Validate working_dir exists if provided
    if working_dir and not os.path.isdir(working_dir):
        return jsonify({"error": f"working_dir not found: {working_dir}"}), 400

    # Handle bare 'cd <path>' — resolve the new dir and return it without running a subprocess
    _cd_match = re.match(r"^cd\s+(.+)$", cmd)
    if _cd_match:
        raw_target = _cd_match.group(1).strip().strip("\"'")
        if raw_target == "-":
            new_dir = working_dir or os.getcwd()
        elif os.path.isabs(raw_target):
            new_dir = raw_target
        else:
            base = working_dir or os.getcwd()
            new_dir = os.path.normpath(os.path.join(base, raw_target))
        if not os.path.isdir(new_dir):
            return jsonify(
                {
                    "rc": 1,
                    "output": f"cd: {raw_target}: No such file or directory",
                    "command": cmd,
                    "working_dir": working_dir or "",
                }
            )
        return jsonify({"rc": 0, "output": "", "command": cmd, "working_dir": new_dir})

    if IS_WINDOWS:
        shell_cmd = ["cmd.exe", "/c", cmd]
    else:
        shell_cmd = ["bash", "-c", cmd]

    rc, out = run_cmd(shell_cmd, timeout=timeout, cwd=working_dir)
    return jsonify(
        {"rc": rc, "output": out, "command": cmd, "working_dir": working_dir or ""}
    )


def main(port=8080, metrics_port=9100):
    start_http_server(metrics_port, registry=REGISTRY)
    logger.info("Agent metrics listening on port %s", metrics_port)
    while True:
        try:
            logger.info("Agent API starting on port %s", port)
            app.run(host="0.0.0.0", port=port)
        except KeyboardInterrupt:
            raise
        except SystemExit as exc:
            logger.error("Agent API exited (%s). Retrying in 5s.", exc)
            time.sleep(5)
        except Exception as exc:
            logger.error("Agent API failed (%s). Retrying in 5s.", exc)
            time.sleep(5)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--metrics-port", type=int, default=9100)
    args = parser.parse_args()
    main(port=args.port, metrics_port=args.metrics_port)
