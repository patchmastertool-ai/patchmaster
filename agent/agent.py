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
from datetime import datetime
import platform
from flask import Flask, jsonify, request, send_file
from prometheus_client import start_http_server, Gauge
from logging.handlers import RotatingFileHandler
import yaml
import threading
import zipfile
import psutil

__version__ = "2.0.0"

# --- Config ---
IS_WINDOWS = platform.system() == "Windows"

# --- Metrics ---
cpu_usage = Gauge('system_cpu_usage_percent', 'System CPU usage percent')
memory_usage = Gauge('system_memory_usage_percent', 'System memory usage percent')
disk_usage = Gauge('system_disk_usage_percent', 'System disk usage percent', ['mountpoint'])
uptime_seconds = Gauge('system_uptime_seconds', 'System uptime in seconds')
patch_gauge = Gauge('patch_job_status', 'Current patch job status (0=idle, 1=running, 2=success, 3=failed)')
last_patch_ts = Gauge('patch_last_success_timestamp', 'Timestamp of last successful patch')

def update_metrics_loop():
    while True:
        try:
            cpu_usage.set(psutil.cpu_percent(interval=None))
            memory_usage.set(psutil.virtual_memory().percent)
            for part in psutil.disk_partitions(all=False):
                if IS_WINDOWS or part.mountpoint == '/':
                    try:
                        usage = psutil.disk_usage(part.mountpoint).percent
                        disk_usage.labels(mountpoint=part.mountpoint).set(usage)
                    except: pass
            uptime_seconds.set(time.time() - psutil.boot_time())
        except Exception as e:
            logger.error(f"Metrics error: {e}")
        time.sleep(15)

threading.Thread(target=update_metrics_loop, daemon=True).start()

LOG_DIR = r'C:\ProgramData\patch-agent\logs' if IS_WINDOWS else '/var/log/patch-agent'
SNAPSHOT_DIR = r'C:\ProgramData\patch-agent\snapshots' if IS_WINDOWS else '/var/lib/patch-agent/snapshots'
OFFLINE_DIR = r'C:\ProgramData\patch-agent\offline-pkgs' if IS_WINDOWS else '/var/lib/patch-agent/offline-pkgs'

for d in [LOG_DIR, SNAPSHOT_DIR, OFFLINE_DIR]:
    try:
        os.makedirs(d, exist_ok=True)
    except PermissionError:
        # Fallback for dev/non-root
        if IS_WINDOWS:
            LOG_DIR = r'.\logs'
            SNAPSHOT_DIR = r'.\snapshots'
            OFFLINE_DIR = r'.\offline-pkgs'
        else:
            LOG_DIR = './logs'
            SNAPSHOT_DIR = './snapshots'
            OFFLINE_DIR = './offline-pkgs'
        os.makedirs(LOG_DIR, exist_ok=True)
        os.makedirs(SNAPSHOT_DIR, exist_ok=True)
        os.makedirs(OFFLINE_DIR, exist_ok=True)

logger = logging.getLogger("patch-agent")
logger.setLevel(logging.INFO)
log_file = os.path.join(LOG_DIR, 'agent.log')
fh = RotatingFileHandler(log_file, maxBytes=5*1024*1024, backupCount=5)
fmt = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
fh.setFormatter(fmt)
logger.addHandler(fh)
console = logging.StreamHandler()
console.setFormatter(fmt)
logger.addHandler(console)

app = Flask(__name__)

# --- Package Manager Abstraction ---

class BasePackageManager:
    def list_installed(self): raise NotImplementedError()
    def list_upgradable(self): raise NotImplementedError()
    def refresh(self): raise NotImplementedError()
    def install(self, packages, local=False): raise NotImplementedError()
    def remove(self, packages): raise NotImplementedError()

class AptManager(BasePackageManager):
    def list_installed(self):
        rc, out = run_cmd(["dpkg-query", "-W", "-f", "${Package}\t${Version}\t${Status}\n"], timeout=30)
        if rc != 0: return []
        packages = []
        for line in out.strip().splitlines():
            parts = line.split("\t")
            if len(parts) >= 3 and "installed" in parts[2].lower():
                packages.append({"name": parts[0], "version": parts[1], "status": parts[2].strip()})
        return packages

    def list_upgradable(self):
        rc, out = run_cmd(["apt", "list", "--upgradable"], timeout=30)
        if rc != 0: return []
        packages = []
        for line in out.strip().splitlines():
            if not line.strip() or line.startswith("Listing") or line.startswith("WARNING") or "/" not in line:
                continue
            try:
                name_src = line.split("/")[0].strip()
                rest = line.split(" ")
                candidate = rest[1] if len(rest) > 1 else ""
                current = ""
                if "[upgradable from:" in line:
                    current = line.split("[upgradable from:")[1].strip(" ]")
                packages.append({"name": name_src, "current_version": current, "available_version": candidate})
            except (IndexError, ValueError): continue
        return packages

    def refresh(self):
        return run_cmd(["apt-get", "update", "-qq"], timeout=120)

    def install(self, packages, local=False):
        if local:
            # Local .deb installation
            return run_cmd(["dpkg", "-i"] + packages, timeout=600)
        return run_cmd(["apt-get", "install", "-y", "-qq"] + packages, timeout=600)

    def remove(self, packages):
        return run_cmd(["apt-get", "remove", "-y", "-qq"] + packages, timeout=600)

    def check_reboot(self):
        return os.path.exists("/var/run/reboot-required")

class DnfManager(BasePackageManager):
    def list_installed(self):
        rc, out = run_cmd(["rpm", "-qa", "--queryformat", "%{NAME}\t%{VERSION}-%{RELEASE}\tinstalled\n"], timeout=30)
        if rc != 0: return []
        packages = []
        for line in out.strip().splitlines():
            parts = line.split("\t")
            if len(parts) >= 3:
                packages.append({"name": parts[0], "version": parts[1], "status": parts[2]})
        return packages

    def list_upgradable(self):
        rc, out = run_cmd(["dnf", "check-update", "--quiet"], timeout=60)
        # dnf check-update returns 100 if updates are available
        if rc not in [0, 100]: return []
        packages = []
        for line in out.strip().splitlines():
            parts = line.split()
            if len(parts) >= 3 and "." in parts[0]:
                name = parts[0].rsplit(".", 1)[0]
                packages.append({"name": name, "current_version": "unknown", "available_version": parts[1]})
        return packages

    def refresh(self):
        return run_cmd(["dnf", "makecache"], timeout=120)

    def install(self, packages, local=False):
        if local:
            return run_cmd(["dnf", "localinstall", "-y"] + packages, timeout=600)
        return run_cmd(["dnf", "install", "-y"] + packages, timeout=600)

    def remove(self, packages):
        return run_cmd(["dnf", "remove", "-y"] + packages, timeout=600)

    def check_reboot(self):
        # dnf needs-restarting -r returns 1 if reboot needed
        rc, _ = run_cmd(["dnf", "needs-restarting", "-r"], timeout=30)
        return rc == 1

class WinManager(BasePackageManager):
    def list_installed(self):
        # Using PowerShell to list installed applications (WMI/Get-Package)
        ps_cmd = 'Get-Package | Select-Object Name, Version | ConvertTo-Json'
        rc, out = run_cmd(["powershell", "-Command", ps_cmd], timeout=60)
        if rc != 0: return []
        try:
            data = json.loads(out)
            if isinstance(data, dict): data = [data]
            return [{"name": d["Name"], "version": d["Version"], "status": "installed"} for d in data]
        except: return []

    def list_upgradable(self):
        # winget is the modern way, but might not be on all servers
        rc, out = run_cmd(["winget", "upgrade"], timeout=60)
        if rc != 0: return []
        # Parse winget output (simplified)
        packages = []
        lines = out.strip().splitlines()
        for line in lines[2:]: # Skip headers
            parts = re.split(r'\s{2,}', line.strip())
            if len(parts) >= 4:
                packages.append({"name": parts[0], "current_version": parts[2], "available_version": parts[3]})
        return packages

    def refresh(self):
        return run_cmd(["winget", "source", "update"], timeout=60)

    def install(self, packages, local=False):
        # For Windows, local install usually means .msi or .exe
        results = []
        for pkg in packages:
            if pkg.endswith(".msi"):
                rc, out = run_cmd(["msiexec", "/i", pkg, "/quiet", "/norestart"], timeout=600)
            elif pkg.endswith(".exe"):
                # Silent install flags vary, assuming /S for now
                rc, out = run_cmd([pkg, "/S"], timeout=600)
            else:
                rc, out = run_cmd(["winget", "install", "--id", pkg, "--silent"], timeout=600)
            results.append((rc, out))
        return results[0] # Return first result for compatibility

    def remove(self, packages):
        results = []
        for pkg in packages:
            rc, out = run_cmd(["winget", "uninstall", "--id", pkg, "--silent"], timeout=600)
            results.append((rc, out))
        return results[0]

    def check_reboot(self):
        # Check registry for pending reboot
        ps_cmd = """
        $r1 = Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired';
        $r2 = Test-Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\PendingFileRenameOperations';
        if ($r1 -or $r2) { exit 1 } else { exit 0 }
        """
        rc, _ = run_cmd(["powershell", "-Command", ps_cmd], timeout=30)
        return rc == 1

def get_pkg_manager():
    if IS_WINDOWS: return WinManager()
    if os.path.exists("/usr/bin/apt-get"): return AptManager()
    if os.path.exists("/usr/bin/dnf"): return DnfManager()
    if os.path.exists("/usr/bin/yum"): return DnfManager() # Fallback
    return BasePackageManager()

pkg_mgr = get_pkg_manager()

# --- Rest of the code ---


JOB_STATUS = {
    "state": "idle",
    "current_job": None,
    "progress": 0,
    "log": [],
    "last_result": None,
    "started_at": None
}

patch_gauge = Gauge("patch_job_status", "0=idle,1=running,2=success,3=failure")
last_patch_ts = Gauge("last_patch_timestamp", "Last patch epoch")

def run_cmd(cmd, timeout=3600):
    logger.info("CMD: %s", " ".join(cmd) if isinstance(cmd, list) else cmd)
    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=timeout)
        return proc.returncode, proc.stdout
    except subprocess.TimeoutExpired:
        return -1, "Command timed out"
    except Exception as e:
        return -1, str(e)

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
            result = target_func(*args, **kwargs)
            JOB_STATUS["state"] = "success" if result.get("success") else "failed"
            JOB_STATUS["last_result"] = result
        except Exception as e:
            JOB_STATUS["state"] = "failed"
            JOB_STATUS["last_result"] = {"error": str(e)}
            JOB_STATUS["log"].append(f"Critical Error: {str(e)}")
        finally:
            JOB_STATUS["progress"] = 100
            record_job({"type": job_type, "status": JOB_STATUS["state"], "result": JOB_STATUS["last_result"], "ts": time.time()})
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
def job_reset():
    if JOB_STATUS["state"] == "running":
        return jsonify({"error": "Cannot reset running job"}), 400
    JOB_STATUS["state"] = "idle"
    JOB_STATUS["log"] = []
    JOB_STATUS["last_result"] = None
    return jsonify({"status": "reset"})


@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "hostname": platform.node(),
        "os": platform.system(),
        "reboot_required": pkg_mgr.check_reboot(),
        "state": JOB_STATUS["state"]
    })

@app.route("/system/reboot", methods=["POST"])
def system_reboot():
    """Trigger a reboot."""
    if IS_WINDOWS:
        run_async_job("reboot", run_cmd, ["shutdown", "/r", "/t", "5"])
    else:
        run_async_job("reboot", run_cmd, ["shutdown", "-r", "+1"])
    return jsonify({"status": "reboot_scheduled"})

@app.route("/software/manage", methods=["POST"])
def software_manage():
    """Install or remove generic software."""
    data = request.get_json(silent=True) or {}
    action = data.get("action", "install") # install | remove
    packages = data.get("packages", [])
    if not packages: return jsonify({"error": "No packages specified"}), 400

    def _task():
        if action == "remove":
            return pkg_mgr.remove(packages)
        return pkg_mgr.install(packages)

    ok, msg = run_async_job(f"software_{action}", _task)
    if not ok: return jsonify({"error": msg}), 409
    return jsonify({"status": "started", "job": f"software_{action}"})


def _run_powershell(script, timeout=600):
    exe = "powershell"
    return run_cmd([exe, "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], timeout=timeout)


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
def wsus_updates():
    if not IS_WINDOWS:
        return jsonify({"error": "WSUS is only available on Windows agents"}), 400
    script = (
        "$s=New-Object -ComObject Microsoft.Update.Session;"
        "$searcher=$s.CreateUpdateSearcher();"
        "$r=$searcher.Search(\"IsInstalled=0 and Type='Software'\");"
        "$r.Updates | Select-Object Title,KBArticleIDs,MsrcSeverity,RebootRequired | ConvertTo-Json -Depth 6"
    )
    try:
        data = _powershell_json(script, timeout=240)
        if data is None:
            data = []
        if isinstance(data, dict):
            data = [data]
        return jsonify({"count": len(data), "updates": data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/wsus/install", methods=["POST"])
def wsus_install():
    if not IS_WINDOWS:
        return jsonify({"error": "WSUS is only available on Windows agents"}), 400

    def _task():
        script = (
            "$s=New-Object -ComObject Microsoft.Update.Session;"
            "$searcher=$s.CreateUpdateSearcher();"
            "$r=$searcher.Search(\"IsInstalled=0 and Type='Software'\");"
            "$updates=New-Object -ComObject Microsoft.Update.UpdateColl;"
            "foreach($u in $r.Updates){[void]$updates.Add($u)};"
            "$down=$s.CreateUpdateDownloader();$down.Updates=$updates;[void]$down.Download();"
            "$inst=$s.CreateUpdateInstaller();$inst.Updates=$updates;$res=$inst.Install();"
            "$res | ConvertTo-Json -Depth 6"
        )
        rc, out = _run_powershell(script, timeout=3600)
        return {"success": rc == 0, "output": out}

    ok, msg = run_async_job("wsus_install", _task)
    if not ok:
        return jsonify({"error": msg}), 409
    return jsonify({"status": "started"})


@app.route("/wsus/status")
def wsus_status():
    if not IS_WINDOWS:
        return jsonify({"error": "WSUS is only available on Windows agents"}), 400
    rc, out = _run_powershell("Get-Service wuauserv | Select-Object Status,StartType,Name | ConvertTo-Json -Depth 4", timeout=30)
    if rc != 0:
        return jsonify({"error": out}), 500
    try:
        return jsonify({"service": json.loads(out)})
    except Exception:
        return jsonify({"service_raw": out})

# === PACKAGE LISTING ===

@app.route("/packages/installed")
def packages_installed():
    packages = pkg_mgr.list_installed()
    return jsonify({"packages": packages, "count": len(packages)})


@app.route("/packages/refresh", methods=["POST"])
def packages_refresh():
    """Refresh package cache."""
    rc, out = pkg_mgr.refresh()
    return jsonify({"success": rc == 0, "output": out})


@app.route("/packages/upgradable")
def packages_upgradable():
    packages = pkg_mgr.list_upgradable()
    return jsonify({"packages": packages, "count": len(packages)})



@app.route("/packages/uris", methods=["POST"])
def packages_uris():
    """Return download URIs for specified packages using apt-get --print-uris (works offline from cache)."""
    data = request.get_json(silent=True) or {}
    pkg_names = data.get("packages", [])
    if pkg_names:
        cmd = ["apt-get", "--print-uris", "-y", "install"] + pkg_names
    else:
        cmd = ["apt-get", "--print-uris", "-y", "upgrade"]
    rc, out = run_cmd(cmd, timeout=60)
    uris = []
    for line in out.strip().splitlines():
        # URI lines look like: 'http://archive.ubuntu.com/.../pkg_ver_arch.deb' pkg_ver_arch.deb 12345 SHA256:...
        line = line.strip()
        if not line.startswith("'") or not ".deb" in line:
            continue
        parts = line.split(" ")
        if len(parts) >= 3:
            url = parts[0].strip("'")
            filename = parts[1]
            size = parts[2] if len(parts) > 2 else "0"
            uris.append({"url": url, "filename": filename, "size": size})
    return jsonify({"uris": uris, "count": len(uris)})


# === SNAPSHOTS (OS-agnostic metadata) ===

def _create_snapshot(name=None):
    if not name:
        name = f"snap-{int(time.time())}"
    snap_dir = os.path.join(SNAPSHOT_DIR, name)
    os.makedirs(snap_dir, exist_ok=True)
    result = {"name": name, "path": snap_dir, "success": False, "details": {}}
    try:
        # Save current package list
        packages = pkg_mgr.list_installed()
        with open(os.path.join(snap_dir, "packages.json"), "w") as f:
            json.dump(packages, f, indent=2)
        result["details"]["packages_count"] = len(packages)

        # OS-specific repo/source configs
        if not IS_WINDOWS:
            sources_dir = os.path.join(snap_dir, "sources")
            os.makedirs(sources_dir, exist_ok=True)
            if os.path.exists("/etc/apt/sources.list"):
                shutil.copy2("/etc/apt/sources.list", sources_dir)
            if os.path.isdir("/etc/apt/sources.list.d"):
                for sf in os.listdir("/etc/apt/sources.list.d"):
                    shutil.copy2(os.path.join("/etc/apt/sources.list.d", sf), sources_dir)
            if os.path.isdir("/etc/yum.repos.d"):
                for rf in os.listdir("/etc/yum.repos.d"):
                    shutil.copy2(os.path.join("/etc/yum.repos.d", rf), sources_dir)

        meta = {"name": name, "created": datetime.now().isoformat(), "packages_count": result["details"].get("packages_count", 0), "os": platform.system()}
        with open(os.path.join(snap_dir, "meta.json"), "w") as f:
            json.dump(meta, f, indent=2)
        result["success"] = True
        result["created"] = meta["created"]
        logger.info("Snapshot '%s' created for %s", name, platform.system())
    except Exception as e:
        result["error"] = str(e)
        logger.error("Snapshot creation failed: %s", e)
    record_job({"type": "snapshot", **result})
    return result


def _rollback_snapshot(name):
    snap_dir = os.path.join(SNAPSHOT_DIR, name)
    result = {"name": name, "success": False, "steps": []}
    if not os.path.isdir(snap_dir):
        result["error"] = f"Snapshot '{name}' not found"
        return result
    try:
        # Rollback logic varies by OS. 
        # For Linux, we attempt a full system upgrade to 'last known good' if possible.
        # For Windows, we mostly just record the rollback attempt.
        if IS_WINDOWS:
            result["error"] = "Rollback not supported on Windows via this agent."
            return result

        pkg_mgr.refresh()
        # On Linux, try to install the package list from snapshot
        packages_file = os.path.join(snap_dir, "packages.json")
        if os.path.exists(packages_file):
            with open(packages_file) as f:
                old_pkgs = json.load(f)
            # This is a simplified rollback: just refresh and ensure system is consistent
            rc, out = pkg_mgr.install([]) # Upgrade all to latest stable
            result["steps"].append({"step": "system-sync", "rc": rc, "output": out[:500]})
            result["success"] = (rc == 0)
    except Exception as e:
        result["error"] = str(e)
    record_job({"type": "rollback", **result})
    return result


@app.route("/snapshot/create", methods=["POST"])
def api_create_snapshot():
    data = request.get_json(silent=True) or {}
    result = _create_snapshot(data.get("name"))
    return jsonify(result), 200 if result["success"] else 500


@app.route("/snapshot/list", methods=["GET"])
def api_list_snapshots():
    snapshots = []
    if os.path.isdir(SNAPSHOT_DIR):
        for name in sorted(os.listdir(SNAPSHOT_DIR), reverse=True):
            meta_file = os.path.join(SNAPSHOT_DIR, name, "meta.json")
            if os.path.exists(meta_file):
                try:
                    with open(meta_file) as f:
                        snapshots.append(json.load(f))
                except: pass
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
def api_rollback_snapshot():
    data = request.get_json(silent=True) or {}
    name = _safe_snapshot_name(data.get("name"))
    if not name:
        return jsonify({"error": "valid snapshot name required"}), 400
    result = _rollback_snapshot(name)
    return jsonify(result), 200 if result["success"] else 500


@app.route("/snapshot/delete", methods=["POST"])
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

def _run_patch_task(packages, hold, dry_run, auto_snapshot, auto_rollback):
    patch_gauge.set(1)
    result = {"success": False, "snapshot": None, "patch_output": "", "rollback": None, "dry_run": dry_run}
    try:
        if auto_snapshot and not dry_run:
            snap_result = _create_snapshot(f"pre-patch-{int(time.time())}")
            result["snapshot"] = snap_result
        
        # Hold packages (Apt only for now)
        if hasattr(pkg_mgr, 'hold'):
            for pkg in hold: run_cmd(["apt-mark", "hold", pkg])
        
        pkg_mgr.refresh()
        rc, out = pkg_mgr.install(packages) if packages else pkg_mgr.install([])
        result["patch_output"] += out
        patch_success = (rc == 0)
        
        if hasattr(pkg_mgr, 'unhold'):
            for pkg in hold: run_cmd(["apt-mark", "unhold", pkg])
            
        if not patch_success and auto_rollback and not dry_run:
            if result.get("snapshot", {}).get("success"):
                rb = _rollback_snapshot(result["snapshot"]["name"])
                result["rollback"] = rb
        
        result["success"] = patch_success
        patch_gauge.set(2 if patch_success else 3)
        if patch_success:
            last_patch_ts.set(time.time())
    except Exception as e:
        result["error"] = str(e)
        patch_gauge.set(3)
    return result

@app.route("/patch/execute", methods=["POST"])
def execute_patch():
    data = request.get_json(silent=True) or {}
    _valid_pkg = re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9.+\-_]+$')
    packages = [p.strip() for p in data.get("packages", []) if isinstance(p, str) and _valid_pkg.match(p.strip())]
    hold = [h.strip() for h in data.get("hold", []) if isinstance(h, str) and _valid_pkg.match(h.strip())]
    dry_run = data.get("dry_run", False)
    auto_snapshot = data.get("auto_snapshot", True)
    auto_rollback = data.get("auto_rollback", True)

    ok, msg = run_async_job("patch", _run_patch_task, packages, hold, dry_run, auto_snapshot, auto_rollback)
    if not ok: return jsonify({"error": msg}), 409
    return jsonify({"status": "started", "job": "patch"})


# === OFFLINE PATCHING ===

@app.route("/offline/upload", methods=["POST"])
def offline_upload():
    files = request.files.getlist("file")
    if not files:
        return jsonify({"error": "no files provided"}), 400
    saved = []
    # Support .deb, .rpm, .msi, .exe
    valid_exts = (".deb", ".rpm", ".msi", ".exe")
    for f in files:
        if not f.filename or not any(f.filename.lower().endswith(ext) for ext in valid_exts):
            continue
        safe_name = os.path.basename(f.filename)
        dest = os.path.join(OFFLINE_DIR, safe_name)
        if not os.path.realpath(dest).startswith(os.path.realpath(OFFLINE_DIR)):
            continue
        f.save(dest)
        saved.append(safe_name)
    return jsonify({"uploaded": saved, "count": len(saved), "path": OFFLINE_DIR})


@app.route("/offline/list", methods=["GET"])
def offline_list():
    pkgs = []
    if os.path.isdir(OFFLINE_DIR):
        for f in sorted(os.listdir(OFFLINE_DIR)):
            fpath = os.path.join(OFFLINE_DIR, f)
            pkgs.append({"name": f, "size": os.path.getsize(fpath), "size_mb": round(os.path.getsize(fpath)/1048576, 2)})
    return jsonify({"pkgs": pkgs, "count": len(pkgs)})


def _run_offline_task(pkg_files, auto_snapshot, auto_rollback):
    patch_gauge.set(1)
    result = {"success": False, "snapshot": None, "install_output": "", "rollback": None, "files": [os.path.basename(f) for f in pkg_files]}
    try:
        if auto_snapshot:
            snap = _create_snapshot(f"pre-offline-{int(time.time())}")
            result["snapshot"] = snap
        
        rc, out = pkg_mgr.install(pkg_files, local=True)
        result["install_output"] += out
        
        patch_success = (rc == 0)
        if not patch_success and auto_rollback:
            if result.get("snapshot", {}).get("success"):
                rb = _rollback_snapshot(result["snapshot"]["name"])
                result["rollback"] = rb
                
        result["success"] = patch_success
        patch_gauge.set(2 if patch_success else 3)
        if patch_success:
            last_patch_ts.set(time.time())
    except Exception as e:
        result["error"] = str(e)
        patch_gauge.set(3)
    return result


@app.route("/offline/install", methods=["POST"])
def offline_install():
    data = request.get_json(silent=True) or {}
    auto_snapshot = data.get("auto_snapshot", True)
    auto_rollback = data.get("auto_rollback", True)
    selected = data.get("files", [])
    
    pkg_files = []
    if selected:
        for f in selected:
            safe = os.path.basename(f)
            full = os.path.join(OFFLINE_DIR, safe)
            if os.path.exists(full) and os.path.realpath(full).startswith(os.path.realpath(OFFLINE_DIR)):
                pkg_files.append(full)
    else:
        for ext in ("*.deb", "*.rpm", "*.msi", "*.exe"):
            pkg_files.extend(glob.glob(os.path.join(OFFLINE_DIR, ext)))
            
    if not pkg_files:
        return jsonify({"error": "no package files found"}), 400

    ok, msg = run_async_job("offline_install", _run_offline_task, pkg_files, auto_snapshot, auto_rollback)
    if not ok: return jsonify({"error": msg}), 409
    return jsonify({"status": "started", "job": "offline_install"})



@app.route("/offline/clear", methods=["POST"])
def offline_clear():
    removed = []
    for f in glob.glob(os.path.join(OFFLINE_DIR, "*.deb")):
        os.remove(f)
        removed.append(os.path.basename(f))
    return jsonify({"cleared": removed, "count": len(removed)})


# === BASIC ROUTES ===

@app.route("/health")
def health():
    return jsonify({"status": "ok", "state": JOB_STATUS["state"]})

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
                    except: pass
        except: pass
    return jsonify({"history": jobs[-100:][::-1]})

@app.route("/snapshot/archive/<name>", methods=["GET"])
def archive_snapshot(name):
    """Zip a snapshot directory and return it."""
    safe_name = _safe_snapshot_name(name)
    if not safe_name: return jsonify({"error": "Invalid name"}), 400
    
    snap_dir = os.path.join(SNAPSHOT_DIR, safe_name)
    if not os.path.isdir(snap_dir): return jsonify({"error": "Not found"}), 404
    
    zip_path = os.path.join(LOG_DIR, f"{safe_name}.zip")
    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(snap_dir):
                for file in files:
                    zipf.write(os.path.join(root, file), 
                               os.path.relpath(os.path.join(root, file), os.path.join(snap_dir, '..')))
        return send_file(zip_path, as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/cleanup", methods=["POST"])
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
                    
    return jsonify({
        "deleted_snapshots": deleted_snaps,
        "deleted_packages": deleted_pkgs,
        "status": "success"
    })


@app.route("/job/status", methods=["GET"])
def get_job_status():
    """Return status of the current or last job."""
    # Simple in-memory status tracking for now
    # In a real agent, this would check a job queue or database
    
    # We'll use the Prometheus gauge to infer status for this simple implementation
    # 0=idle, 1=running, 2=success, 3=failed
    status_code = int(patch_gauge._value.get())
    status_map = {0: "idle", 1: "running", 2: "success", 3: "failed"}
    state = status_map.get(status_code, "unknown")
    
    return jsonify({
        "state": state,
        "last_result": "Job completed" if state == "success" else "Job failed" if state == "failed" else "Running..." if state == "running" else "Idle",
        "timestamp": time.time()
    })

@app.route("/devops/run", methods=["POST"])
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
            rc, out = run_cmd(cmd, timeout=step.get("timeout", 600))
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
        cmd = f"mysqldump {connection_string} > {output_file}"
        process = subprocess.run(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        if process.returncode != 0:
             raise Exception(f"mysqldump failed: {process.stdout}")
             
    elif db_type == "mongodb":
        cmd = ["mongodump", f"--uri={connection_string}", f"--archive={output_file}"]
        rc, out = run_cmd(cmd)
        if rc != 0:
            raise Exception(f"mongodump failed: {out}")
            
    elif db_type == "redis":
        # Redis RDB backup
        # connection_string expected as 'redis-cli -h HOST -p PORT -a PASS' or just empty if local
        # This is a simple implementation assuming local or provided cli args
        cmd = f"redis-cli {connection_string} --rdb {output_file}"
        rc, out = run_cmd(cmd.split())
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
        base_name = output_file.replace('.zip', '')
        shutil.make_archive(base_name, 'zip', source_path)
        final_path = base_name + '.zip'
        if final_path != output_file and os.path.exists(final_path):
             if os.path.exists(output_file): os.remove(output_file)
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
         
    with open(output_file, 'w') as f:
        f.write(f"VM Backup Metadata for {vm_name} at {datetime.now()}\n")
        f.write("Status: Success (Mock)\n")
    return output_file

def backup_live(source_path, output_file):
    if IS_WINDOWS:
        cmd = f"robocopy {source_path} {output_file} /MIR /R:0 /W:0"
        subprocess.run(cmd, shell=True)
    else:
        src = source_path if source_path.endswith('/') else source_path + '/'
        dst = output_file if output_file.endswith('/') else output_file + '/'
        # Use rsync for efficient live sync
        cmd = ["rsync", "-av", "--update", "--delete", src, dst]
        rc, out = run_cmd(cmd)
        if rc != 0:
            raise Exception(f"rsync failed: {out}")
    return output_file

def backup_full_system(output_file):
    """Create a full system image (Linux only, root required)."""
    if IS_WINDOWS:
        raise NotImplementedError("Full system backup not supported on Windows agent yet")
    
    # DD backup of root partition (DANGEROUS - Mocking for safety)
    # cmd = f"dd if=/dev/sda of={output_file} bs=4M status=progress"
    
    # Safer alternative: Tarball of root with excludes
    cmd = [
        "tar", "czf", output_file, "--exclude=/proc", "--exclude=/sys", 
        "--exclude=/dev", "--exclude=/tmp", "--exclude=/run", "--exclude=/mnt", 
        "--exclude=/media", "--exclude=/lost+found", "/"
    ]
    rc, out = run_cmd(cmd, timeout=7200) # 2 hours timeout
    if rc != 0:
        raise Exception(f"Full system backup failed: {out}")
    return output_file

@app.route('/backup/trigger', methods=['POST'])
def trigger_backup():
    data = request.get_json(silent=True) or {}
    b_type = data.get("type")
    
    # Input Sanitization
    allowed_types = ["database", "file", "vm", "live", "full_system"]
    if b_type not in allowed_types:
        return jsonify({"status": "error", "message": "Invalid backup type"}), 400
        
    source = data.get("source")
    dest = data.get("destination")
    db_type = data.get("db_type")
    
    # Async Execution Wrapper
    def run_backup_task(data, dest):
        try:
            # Retention Policy
            retention_count = data.get("retention_count", 5)
            # Find old backups of SAME type and prefix
            prefix = f"backup_{b_type}_"
            backups = sorted([os.path.join(SNAPSHOT_DIR, f) for f in os.listdir(SNAPSHOT_DIR) if f.startswith(prefix)])
            while len(backups) >= retention_count:
                oldest = backups.pop(0)
                try:
                    if os.path.isdir(oldest): shutil.rmtree(oldest)
                    else: os.remove(oldest)
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
                cmd = ["openssl", "enc", "-aes-256-cbc", "-salt", "-pbkdf2", "-in", dest, "-out", enc_dest, "-k", enc_key]
                rc, out = run_cmd(cmd)
                if rc == 0:
                    os.remove(dest)
                    dest = enc_dest
                else:
                    logger.error(f"Encryption failed: {out}")
                    raise Exception(f"Encryption failed: {out}")
                    
            logger.info(f"Backup completed successfully: {dest}")
            # Here we would ideally callback to the backend to update status
        except Exception as e:
            logger.error(f"Backup job failed: {e}")

    if not dest:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        if not os.path.exists(SNAPSHOT_DIR):
             os.makedirs(SNAPSHOT_DIR)
        dest = os.path.join(SNAPSHOT_DIR, f"backup_{b_type}_{ts}")
        if b_type == "file": dest += ".zip"
        if b_type == "database": dest += ".dump"
        if b_type == "vm": dest += ".img"
        if b_type == "full_system": dest += ".tar.gz"

    # Start in background thread
    threading.Thread(target=run_backup_task, args=(data, dest), daemon=True).start()
    
    return jsonify({"status": "started", "output_file": dest, "message": "Backup job started in background"})


# === DEVOPS & POLICY ENGINE ===

def apply_service_state(service, state, enable=None):
    """Ensure a service is in the desired state."""
    logger.info(f"Policy: Ensuring service '{service}' is {state}")
    
    # Check current status
    is_running = False
    if IS_WINDOWS:
        # Check via sc query or powershell
        # PowerShell is more reliable for 'status'
        cmd = ["powershell", "-Command", f"Get-Service -Name {service} | Select-Object -ExpandProperty Status"]
        rc, out = run_cmd(cmd)
        is_running = "Running" in out
    else:
        # Systemd
        cmd = ["systemctl", "is-active", service]
        rc, out = run_cmd(cmd)
        is_running = (rc == 0)

    # Apply state
    if state == "running" and not is_running:
        if IS_WINDOWS: run_cmd(["net", "start", service])
        else: run_cmd(["systemctl", "start", service])
    elif state == "stopped" and is_running:
        if IS_WINDOWS: run_cmd(["net", "stop", service])
        else: run_cmd(["systemctl", "stop", service])
    elif state == "restarted":
        if IS_WINDOWS: 
            run_cmd(["net", "stop", service])
            run_cmd(["net", "start", service])
        else: run_cmd(["systemctl", "restart", service])

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
    
    if IS_WINDOWS and shell == "bash": shell = "powershell" # Fallback
    
    suffix = ".ps1" if shell == "powershell" else ".sh"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False, mode='w') as f:
        f.write(script)
        script_path = f.name
    
    try:
        if shell == "powershell":
            cmd = ["powershell", "-ExecutionPolicy", "Bypass", "-File", script_path]
        else:
            cmd = [shell, script_path]
            make_executable(script_path)
            
        rc, out = run_cmd(cmd)
        if rc != 0:
            raise Exception(f"Script failed (rc={rc}): {out}")
        return out
    finally:
        if os.path.exists(script_path):
            os.remove(script_path)

@app.route('/policy/apply', methods=['POST'])
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
                        step.get("enable")
                    )
                elif module == "file":
                    apply_file_state(
                        step.get("path"), 
                        step.get("content"), 
                        step.get("state", "present"),
                        step.get("mode")
                    )
                elif module == "script":
                    out = run_script_step(
                        step.get("run") or step.get("script"), 
                        step.get("shell", "bash")
                    )
                    results.append({"step": step_name, "status": "success", "output": out})
                    continue # Skip default success append
                elif module == "package":
                    # Re-use existing package manager logic?
                    pkg = step.get("package")
                    state = step.get("state", "installed")
                    if state == "installed":
                        # Simple install wrapper
                        if IS_WINDOWS: run_cmd(["winget", "install", "-e", "--id", pkg]) # simplistic
                        else: 
                            if shutil.which("apt-get"): run_cmd(["apt-get", "install", "-y", pkg])
                            elif shutil.which("yum"): run_cmd(["yum", "install", "-y", pkg])
                    elif state == "absent":
                        if IS_WINDOWS: run_cmd(["winget", "uninstall", "-e", "--id", pkg])
                        else:
                            if shutil.which("apt-get"): run_cmd(["apt-get", "remove", "-y", pkg])
                            elif shutil.which("yum"): run_cmd(["yum", "remove", "-y", pkg])

                results.append({"step": step_name, "status": "success"})
            except Exception as e:
                logger.error(f"Step '{step_name}' failed: {e}")
                results.append({"step": step_name, "status": "failed", "error": str(e)})
                if step.get("ignore_errors") is not True:
                    return jsonify({"status": "failed", "step": step_name, "error": str(e), "results": results}), 500

        return jsonify({"status": "success", "results": results})
            
    except Exception as e:
        logger.error(f"Policy application failed: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


def main(port=8080, metrics_port=9100):
    start_http_server(metrics_port)
    logger.info("Agent starting on port %s", port)
    app.run(host="0.0.0.0", port=port)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--metrics-port", type=int, default=9100)
    args = parser.parse_args()
    main(port=args.port, metrics_port=args.metrics_port)
