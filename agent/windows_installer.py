import argparse
import ctypes
import glob
import os
import shutil
import subprocess
import sys
import socket
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Optional, Dict
from urllib.parse import urlsplit, urlunsplit
from xml.sax.saxutils import escape
import logging


def _is_admin() -> bool:
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def _run(cmd):
    p = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return p.returncode, p.stdout


def _remove_legacy_tasks():
    for task in ("PatchMaster-Agent", "PatchMaster-Agent-Heartbeat"):
        _run(["schtasks", "/Delete", "/TN", task, "/F"])


def _stop_and_uninstall_service(wrapper: Path):
    if wrapper.exists():
        _run([str(wrapper), "stop"])
        _run([str(wrapper), "uninstall"])


def _kill_processes():
    # Best-effort kill of running binaries that may keep files locked
    for exe in ("patch-agent.exe", "patch-agent-heartbeat.exe"):
        _run(["taskkill", "/F", "/IM", exe])


def _firewall_rule_name(kind: str, port: str) -> str:
    return f"PatchMaster Agent {kind} {port}"


def _ensure_firewall_rule(port: str, kind: str, allow_from: str | None = None) -> None:
    name = _firewall_rule_name(kind, port)
    remote_ip = (allow_from or "").strip()
    if not remote_ip:
        remote_ip = "any"
    _run(
        [
            "netsh",
            "advfirewall",
            "firewall",
            "add",
            "rule",
            f"name={name}",
            "dir=in",
            "action=allow",
            "protocol=TCP",
            f"localport={port}",
            f"remoteip={remote_ip}",
        ]
    )


def _ensure_firewall_outbound_rule(remote_host: str, remote_port: int) -> None:
    if not remote_host or not remote_port:
        return
    name = f"PatchMaster Agent Controller {remote_host}:{remote_port}"
    _run(
        [
            "netsh",
            "advfirewall",
            "firewall",
            "add",
            "rule",
            f"name={name}",
            "dir=out",
            "action=allow",
            "protocol=TCP",
            f"remoteip={remote_host}",
            f"remoteport={remote_port}",
        ]
    )


def _remove_firewall_rule(port: str, kind: str) -> None:
    name = _firewall_rule_name(kind, port)
    _run(
        [
            "netsh",
            "advfirewall",
            "firewall",
            "delete",
            "rule",
            f"name={name}",
        ]
    )


def _check_tcp_connectivity(host: str, port: int, timeout: float = 3.0) -> bool:
    try:
        with socket.create_connection((host, int(port)), timeout=timeout):
            return True
    except Exception:
        return False


def _wait_for_local_http_health(port: str, timeout_sec: int = 20) -> bool:
    end = time.time() + max(timeout_sec, 1)
    urls = [
        f"http://127.0.0.1:{port}/health",
        f"http://127.0.0.1:{port}/metrics",
        f"http://127.0.0.1:{port}/",
    ]
    while time.time() < end:
        for url in urls:
            try:
                with urllib.request.urlopen(url, timeout=2) as resp:
                    if 200 <= int(resp.status) < 300:
                        return True
            except Exception:
                continue
        time.sleep(1)
    return False


def _recent_log_snippet(log_dir: Path, max_files: int = 3, tail_lines: int = 40) -> str:
    try:
        files = sorted(
            glob.glob(str(log_dir / "*.log")),
            key=lambda p: os.path.getmtime(p),
            reverse=True,
        )[:max_files]
        out = []
        for fp in files:
            try:
                with open(fp, "r", encoding="utf-8", errors="replace") as f:
                    lines = f.read().splitlines()[-tail_lines:]
                out.append(f"\n--- {os.path.basename(fp)} ---\n" + "\n".join(lines))
            except Exception:
                continue
        return "\n".join(out).strip()
    except Exception:
        return ""


def _get_service_status(service_name: str) -> dict:
    """Query Windows service status via sc query and return structured info."""
    rc, out = _run(["sc", "query", service_name])
    if rc != 0:
        return {"exists": False, "state": "not_found", "raw": out}
    state = "unknown"
    for line in out.splitlines():
        if "STATE" in line:
            if "RUNNING" in line:
                state = "running"
            elif "STOPPED" in line:
                state = "stopped"
            elif "PAUSED" in line:
                state = "paused"
            elif "START_PENDING" in line:
                state = "start_pending"
            elif "STOP_PENDING" in line:
                state = "stop_pending"
    return {"exists": True, "state": state, "raw": out}


def _diagnose_installation_failure(
    install_dir: Path,
    service_api: str = "PatchMaster-Agent",
    service_hb: str = "PatchMaster-Agent-Heartbeat",
) -> str:
    """Collect diagnostic information for installation failures."""
    log_dir = (
        Path(os.environ.get("ProgramData", r"C:\ProgramData"))
        / "PatchMaster-Agent"
        / "logs"
    )
    diagnostics = []

    # Check service states
    diagnostics.append("=== Service Status ===")
    for svc in [service_api, service_hb]:
        status = _get_service_status(svc)
        diagnostics.append(f"{svc}: {status.get('state', 'unknown')}")

    # Check files exist
    diagnostics.append("\n=== File Check ===")
    for f in ["patch-agent.exe", "patch-agent-heartbeat.exe", "winsw.exe"]:
        path = install_dir / f
        diagnostics.append(f"{f}: {'EXISTS' if path.exists() else 'MISSING'}")

    # Check Program Files permissions
    diagnostics.append("\n Permissions ===")
    try:
        test_file = install_dir / ".write-test"
        test_file.write_text("test")
        test_file.unlink()
        diagnostics.append("Install dir: WRITABLE")
    except PermissionError:
        diagnostics.append("Install dir: PERMISSION DENIED - Run as Administrator")
    except Exception as e:
        diagnostics.append(f"Install dir: ERROR - {e}")

    # Check winsw.exe exists and is valid (not empty/corrupted)
    winsw = install_dir / "winsw.exe"
    if winsw.exists():
        size = winsw.stat().st_size
        diagnostics.append(f"winsw.exe: {size} bytes")
        if size < 10000:
            diagnostics.append(
                "WARNING: winsw.exe appears too small - may be corrupted"
            )
    else:
        diagnostics.append("winsw.exe: MISSING")

    # Get recent log excerpt
    snippet = _recent_log_snippet(log_dir, max_files=1, tail_lines=20)
    if snippet:
        diagnostics.append(f"\n=== Recent Logs ===\n{snippet}")

    # Check firewall rules
    diagnostics.append("\n=== Firewall Rules ===")
    for port, kind in [("18080", "API"), ("9100", "Metrics")]:
        rc, out = _run(
            ["netsh", "advfirewall", "firewall", "show", "rule", f"name=all", f""]
        )
        if f"PatchMaster Agent {kind}" in out:
            diagnostics.append(f"PatchMaster Agent {kind} port {port}: EXISTS")
        else:
            diagnostics.append(f"PatchMaster Agent {kind} port {port}: MISSING")

    return "\n".join(diagnostics)


def _analyze_failure_reason(out: str, rc: int) -> tuple[str, str, str]:
    """Analyze error output to determine failure type and resolution.

    Returns: (failure_type, message, resolution)
    """
    out_lower = out.lower()
    rc_str = str(rc)

    # Permission denied on Program Files
    if "permission" in out_lower or "denied" in out_lower or rc == 5:
        if "program" in out_lower or "files" in out_lower:
            return (
                "permission_denied",
                "Permission denied on Program Files",
                "Run as Administrator",
            )

    # Service installation timeout
    if "timeout" in out_lower or "1053" in out or "1054" in out or rc == 1053:
        return (
            "service_timeout",
            "Service installation timed out",
            "Retry installation or check Windows Event Log",
        )

    # Firewall rule creation failure
    if "firewall" in out_lower and ("error" in out_lower or "failed" in out_lower):
        return (
            "firewall_failed",
            "Firewall rule creation failed",
            "Run as Administrator or manually create firewall rules",
        )

    # Winsw.exe binary missing or corrupted
    if "winsw" in out_lower or "not found" in out_lower or "the system" in out_lower:
        return (
            "winsw_missing",
            "Service wrapper (winsw.exe) missing or corrupted",
            "Re-download installer and extract winsw.exe",
        )

    # Service already exists
    if "already exists" in out_lower or rc == 1072:
        return (
            "service_exists",
            "Service already exists",
            "Stop existing service or run --uninstall first",
        )

    # Generic failure
    return (
        "unknown",
        f"Installation failed (exit code {rc})",
        "Check installation logs for details",
    )


def _retry_with_backoff(
    func,
    max_retries: int = 3,
    base_delay: float = 2.0,
    max_delay: float = 30.0,
    exponential: bool = True,
):
    """Retry a function with exponential backoff.

    Args:
        func: Callable to retry
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay in seconds
        max_delay: Maximum delay cap in seconds
        exponential: Use exponential backoff if True, linear if False

    Returns:
        Tuple of (success: bool, result: Any, last_exception: Exception)
    """
    last_exc = None
    for attempt in range(max_retries + 1):
        try:
            result = func()
            return True, result, None
        except Exception as e:
            last_exc = e
            if attempt < max_retries:
                delay = base_delay * (2**attempt if exponential else attempt)
                time.sleep(min(delay, max_delay))
    return False, None, last_exc


def _write_service_xml(
    path: Path,
    service_id: str,
    name: str,
    description: str,
    executable: str,
    arguments: str = "",
    env: Optional[Dict[str, str]] = None,
    log_dir: Optional[Path] = None,
    working_dir: Optional[Path] = None,
):
    env_lines = ""
    if env:
        for k, v in env.items():
            env_lines += f'  <env name="{escape(str(k))}" value="{escape(str(v))}" />\n'

    log_lines = ""
    if log_dir:
        log_lines = (
            f"  <logpath>{escape(str(log_dir))}</logpath>\n"
            '  <log mode="roll-by-size">\n'
            "    <sizeThreshold>10485760</sizeThreshold>\n"
            "    <keepFiles>5</keepFiles>\n"
            "  </log>\n"
        )

    work_line = ""
    if working_dir:
        work_line = (
            f"  <workingdirectory>{escape(str(working_dir))}</workingdirectory>\n"
        )

    xml = (
        "<service>\n"
        f"  <id>{escape(service_id)}</id>\n"
        f"  <name>{escape(name)}</name>\n"
        f"  <description>{escape(description)}</description>\n"
        f"  <executable>{escape(executable)}</executable>\n"
        f"  <arguments>{escape(arguments)}</arguments>\n"
        f"{work_line}"
        f"{env_lines}"
        f"{log_lines}"
        "  <startmode>Automatic</startmode>\n"
        "</service>\n"
    )
    path.write_text(xml, encoding="utf-8")


def _install_services(
    install_dir: Path,
    master_url: str,
    agent_port: str,
    metrics_port: str,
    winsw_src: Path,
    site: str | None = None,
    allow_from: str | None = None,
    wbadmin_target: str | None = None,
    require_connectivity: bool = False,
    strict_health: bool = False,
):
    api_exe = install_dir / "patch-agent.exe"
    hb_exe = install_dir / "patch-agent-heartbeat.exe"

    service_api = "PatchMaster-Agent"
    service_hb = "PatchMaster-Agent-Heartbeat"

    api_wrapper = install_dir / f"{service_api}.exe"
    hb_wrapper = install_dir / f"{service_hb}.exe"

    shutil.copy2(winsw_src, api_wrapper)
    shutil.copy2(winsw_src, hb_wrapper)

    log_dir = (
        Path(os.environ.get("ProgramData", r"C:\ProgramData"))
        / "PatchMaster-Agent"
        / "logs"
    )
    log_dir.mkdir(parents=True, exist_ok=True)

    api_env: Dict[str, str] = {}
    if wbadmin_target and wbadmin_target.strip():
        normalized_target = wbadmin_target.strip()
        api_env["WBADMIN_BACKUP_TARGET"] = normalized_target
        api_env["PM_WINDOWS_WBADMIN_TARGET"] = normalized_target
    if site and site.strip():
        api_env["PATCHMASTER_SITE"] = site.strip()[:120]

    _write_service_xml(
        install_dir / f"{service_api}.xml",
        service_id=service_api,
        name="PatchMaster Agent",
        description="PatchMaster Agent Service",
        executable=str(api_exe),
        arguments=f"--port {agent_port} --metrics-port {metrics_port}",
        env=api_env,
        log_dir=log_dir,
        working_dir=install_dir,
    )
    _write_service_xml(
        install_dir / f"{service_hb}.xml",
        service_id=service_hb,
        name="PatchMaster Agent Heartbeat",
        description="PatchMaster Agent Heartbeat Service",
        executable=str(hb_exe),
        arguments="",
        env={
            "CONTROLLER_URL": master_url,
            **(
                {"PATCHMASTER_SITE": site.strip()[:120]}
                if site and site.strip()
                else {}
            ),
        },
        log_dir=log_dir,
        working_dir=install_dir,
    )

    # Clean any old tasks/services
    _remove_legacy_tasks()
    for wrapper in (api_wrapper, hb_wrapper):
        _run([str(wrapper), "stop"])
        _run([str(wrapper), "uninstall"])

    # Install API service with retry
    def install_api():
        rc1, out1 = _run([str(api_wrapper), "install"])
        if rc1 != 0:
            failure_type, msg, resolution = _analyze_failure_reason(out1, rc1)
            raise RuntimeError(f"{msg}. {resolution}\nDetails: {out1}")
        return rc1, out1

    def install_hb():
        rc2, out2 = _run([str(hb_wrapper), "install"])
        if rc2 != 0:
            failure_type, msg, resolution = _analyze_failure_reason(out2, rc2)
            raise RuntimeError(f"{msg}. {resolution}\nDetails: {out2}")
        return rc2, out2

    # Retry service installation with exponential backoff
    success_api, _, exc_api = _retry_with_backoff(
        install_api, max_retries=2, base_delay=2.0
    )
    if not success_api:
        diagnostics = _diagnose_installation_failure(install_dir)
        raise RuntimeError(
            f"Failed to install API service after retries.\nDiagnostics:\n{diagnostics}"
        )

    success_hb, _, exc_hb = _retry_with_backoff(
        install_hb, max_retries=2, base_delay=2.0
    )
    if not success_hb:
        diagnostics = _diagnose_installation_failure(install_dir)
        raise RuntimeError(
            f"Failed to install heartbeat service after retries.\nDiagnostics:\n{diagnostics}"
        )

    _ensure_firewall_rule(agent_port, "API", allow_from=allow_from)
    _ensure_firewall_rule(metrics_port, "Metrics", allow_from=allow_from)
    parsed = urlsplit(master_url)
    master_host = parsed.hostname or ""
    master_port = parsed.port or (443 if parsed.scheme == "https" else 8000)
    if master_host:
        _ensure_firewall_outbound_rule(master_host, int(master_port))

    # Retry service startup with exponential backoff
    def start_service(wrapper):
        rc, out = _run([str(wrapper), "start"])
        if rc != 0:
            raise RuntimeError(f"Service start failed: {out}")
        return True

    success_api_start, _, exc_api_start = _retry_with_backoff(
        lambda: start_service(api_wrapper), max_retries=2, base_delay=3.0
    )
    if not success_api_start:
        diagnostics = _diagnose_installation_failure(install_dir)
        raise RuntimeError(
            f"Failed to start API service after retries.\nDiagnostics:\n{diagnostics}"
        )

    success_hb_start, _, exc_hb_start = _retry_with_backoff(
        lambda: start_service(hb_wrapper), max_retries=2, base_delay=3.0
    )
    if not success_hb_start:
        diagnostics = _diagnose_installation_failure(install_dir)
        raise RuntimeError(
            f"Failed to start heartbeat service after retries.\nDiagnostics:\n{diagnostics}"
        )

    api_ok = _wait_for_local_http_health(agent_port, timeout_sec=90)
    api_port_open = _check_tcp_connectivity("127.0.0.1", int(agent_port), timeout=2.0)
    hb_ok = _check_tcp_connectivity("127.0.0.1", int(metrics_port), timeout=2.0)
    if master_host:
        controller_ok = _check_tcp_connectivity(
            master_host, int(master_port), timeout=4.0
        )
        print(
            f"[CHECK] controller {master_host}:{master_port} reachable={controller_ok}"
        )
        if require_connectivity and not controller_ok:
            raise RuntimeError(
                f"Controller {master_host}:{master_port} is not reachable from this host"
            )
    print(f"[CHECK] api health on 127.0.0.1:{agent_port} ok={api_ok}")
    print(f"[CHECK] api tcp on 127.0.0.1:{agent_port} open={api_port_open}")
    print(f"[CHECK] metrics port on 127.0.0.1:{metrics_port} open={hb_ok}")
    if not api_ok:
        if api_port_open and not strict_health:
            print(
                f"[WARN] API health endpoint did not return 2xx yet, but port {agent_port} is open. Continuing install (non-strict mode)."
            )
        else:
            snippet = _recent_log_snippet(log_dir)
            extra = f"\nRecent logs:{snippet}" if snippet else ""
            raise RuntimeError(
                f"API health check failed on port {agent_port}. Check service logs in ProgramData\\PatchMaster-Agent\\logs.{extra}"
            )


def _uninstall_services(
    install_dir: Path, agent_port: str = "8080", metrics_port: str = "9100"
):
    service_api = "PatchMaster-Agent"
    service_hb = "PatchMaster-Agent-Heartbeat"
    api_wrapper = install_dir / f"{service_api}.exe"
    hb_wrapper = install_dir / f"{service_hb}.exe"

    _stop_and_uninstall_service(api_wrapper)
    _stop_and_uninstall_service(hb_wrapper)
    _remove_legacy_tasks()
    _remove_firewall_rule(agent_port, "API")
    _remove_firewall_rule(metrics_port, "Metrics")


def _cleanup_files(
    install_dir: Path, agent_port: str = "8080", metrics_port: str = "9100"
):
    program_data = (
        Path(os.environ.get("ProgramData", r"C:\ProgramData")) / "PatchMaster-Agent"
    )
    _kill_processes()
    _uninstall_services(install_dir, agent_port=agent_port, metrics_port=metrics_port)
    try:
        shutil.rmtree(install_dir, ignore_errors=True)
    except Exception:
        pass


def _normalize_master_url(master_url: str) -> str:
    raw = (master_url or "").strip().strip("`'\" ").rstrip("/")
    if not raw:
        return raw
    try:
        parsed = urlsplit(raw)
    except Exception:
        return raw
    if not parsed.scheme or not parsed.netloc:
        return raw
    host = parsed.hostname or parsed.netloc
    port = parsed.port
    if port == 3000:
        port = 8000
    elif port is None and parsed.scheme == "http":
        port = 8000
    elif port is None and parsed.scheme == "https":
        port = 443
    netloc = f"{host}:{port}" if port not in (80, 443) else host
    return urlunsplit((parsed.scheme, netloc, "", "", ""))


def _read_existing_master_url(install_dir: Path) -> str:
    xml_path = install_dir / "PatchMaster-Agent-Heartbeat.xml"
    if not xml_path.exists():
        return ""
    try:
        root = ET.fromstring(xml_path.read_text(encoding="utf-8"))
    except Exception:
        return ""
    for env in root.findall("env"):
        if (env.attrib.get("name") or "").strip() == "CONTROLLER_URL":
            return _normalize_master_url(env.attrib.get("value") or "")
    return ""


def _read_existing_ports(install_dir: Path) -> tuple[str, str]:
    xml_path = install_dir / "PatchMaster-Agent.xml"
    if not xml_path.exists():
        return "", ""
    try:
        root = ET.fromstring(xml_path.read_text(encoding="utf-8"))
    except Exception:
        return "", ""
    args = (root.findtext("arguments") or "").strip().split()
    agent_port = ""
    metrics_port = ""
    for idx, token in enumerate(args):
        if token == "--port" and idx + 1 < len(args):
            agent_port = args[idx + 1]
        if token == "--metrics-port" and idx + 1 < len(args):
            metrics_port = args[idx + 1]
    return agent_port, metrics_port


def main():
    p = argparse.ArgumentParser()
    p.add_argument(
        "--master-url",
        default=None,
        help="PatchMaster master URL (e.g. http://192.168.1.10:8000)",
    )
    p.add_argument("--agent-port", default=os.environ.get("AGENT_PORT"))
    p.add_argument("--metrics-port", default=os.environ.get("METRICS_PORT"))
    p.add_argument(
        "--site",
        default=os.environ.get("PATCHMASTER_SITE")
        or os.environ.get("PATCHMASTER_LOCATION")
        or "",
        help="Optional site or location label for this endpoint",
    )
    p.add_argument(
        "--allow-from",
        default=os.environ.get("PM_AGENT_ALLOW_FROM") or None,
        help="Optional remote IP/CIDR allowlist for Windows Firewall rules",
    )
    p.add_argument(
        "--wbadmin-target",
        default=os.environ.get("PM_WINDOWS_WBADMIN_TARGET")
        or os.environ.get("WBADMIN_BACKUP_TARGET")
        or None,
        help="Windows wbadmin backup target (e.g. \\\\server\\share or E:)",
    )
    p.add_argument(
        "--wbadmin-share-name",
        default=os.environ.get("PM_WINDOWS_WBADMIN_SHARE_NAME")
        or "patchmaster-wbadmin",
    )
    p.add_argument(
        "--require-connectivity",
        action="store_true",
        help="Fail install if controller connectivity check does not pass",
    )
    p.add_argument(
        "--strict-health",
        action="store_true",
        help="Fail install when /health is not 2xx even if API port is open",
    )
    p.add_argument(
        "--install-dir",
        default=str(
            Path(os.environ.get("ProgramFiles", r"C:\Program Files"))
            / "PatchMaster-Agent"
        ),
    )
    p.add_argument("--no-pause", action="store_true")
    p.add_argument(
        "--uninstall",
        action="store_true",
        help="Stop services and remove PatchMaster Agent files",
    )
    args = p.parse_args()

    if not _is_admin():
        print("[ERROR] Please run as Administrator.")
        if not args.no_pause:
            input("Press Enter to exit...")
        return 1

    install_dir = Path(args.install_dir)
    existing_agent_port, existing_metrics_port = _read_existing_ports(install_dir)
    preferred_windows_port = (
        os.environ.get("PM_WINDOWS_AGENT_PORT") or "18080"
    ).strip()
    agent_port = (
        args.agent_port or existing_agent_port or preferred_windows_port
    ).strip()
    if (
        (not args.agent_port)
        and existing_agent_port == "8080"
        and preferred_windows_port != "8080"
    ):
        agent_port = preferred_windows_port
    metrics_port = (args.metrics_port or existing_metrics_port or "9100").strip()

    if args.uninstall:
        _cleanup_files(install_dir, agent_port=agent_port, metrics_port=metrics_port)
        print("[SUCCESS] PatchMaster Agent uninstalled.")
        if not args.no_pause:
            input("Press Enter to exit...")
        return 0

    install_dir.mkdir(parents=True, exist_ok=True)

    master_url = (
        args.master_url
        or os.environ.get("MASTER_URL")
        or _read_existing_master_url(install_dir)
    )
    if not master_url:
        if args.no_pause:
            print("[ERROR] MASTER_URL is required (use --master-url).")
            return 1
        master_url = input(
            "Enter PatchMaster Master URL (example: http://192.168.1.10:8000): "
        ).strip()
    if not master_url:
        print("[ERROR] MASTER_URL is required.")
        if not args.no_pause:
            input("Press Enter to exit...")
        return 1
    master_url = _normalize_master_url(master_url)
    wbadmin_target = (args.wbadmin_target or "").strip()
    if not wbadmin_target:
        try:
            parsed = urlsplit(master_url)
            share_name = (
                (args.wbadmin_share_name or "patchmaster-wbadmin").strip().strip("\\/")
            )
            if parsed.hostname and share_name:
                wbadmin_target = f"\\\\{parsed.hostname}\\{share_name}"
        except Exception:
            wbadmin_target = ""

    bundle_dir = Path(getattr(sys, "_MEIPASS", Path(__file__).parent))
    src_api = bundle_dir / "patch-agent.exe"
    src_hb = bundle_dir / "patch-agent-heartbeat.exe"
    src_winsw = bundle_dir / "winsw.exe"
    if not src_api.exists() or not src_hb.exists() or not src_winsw.exists():
        print(
            "[ERROR] Installer payload is missing (patch-agent.exe / patch-agent-heartbeat.exe / winsw.exe)."
        )
        if not args.no_pause:
            input("Press Enter to exit...")
        return 1

    try:
        _kill_processes()
        _uninstall_services(
            install_dir, agent_port=agent_port, metrics_port=metrics_port
        )
    except Exception:
        pass
    try:
        shutil.copy2(src_api, install_dir / "patch-agent.exe")
        shutil.copy2(src_hb, install_dir / "patch-agent-heartbeat.exe")
        shutil.copy2(src_winsw, install_dir / "winsw.exe")
    except PermissionError:
        _kill_processes()
        _uninstall_services(
            install_dir, agent_port=agent_port, metrics_port=metrics_port
        )
        shutil.copy2(src_api, install_dir / "patch-agent.exe")
        shutil.copy2(src_hb, install_dir / "patch-agent-heartbeat.exe")
        shutil.copy2(src_winsw, install_dir / "winsw.exe")

    try:
        _install_services(
            install_dir,
            master_url,
            agent_port,
            metrics_port,
            install_dir / "winsw.exe",
            site=args.site,
            allow_from=args.allow_from,
            wbadmin_target=wbadmin_target or None,
            require_connectivity=bool(args.require_connectivity),
            strict_health=bool(args.strict_health),
        )
    except Exception as e:
        print(f"[ERROR] Failed to create Windows services: {e}")
        if not args.no_pause:
            input("Press Enter to exit...")
        return 1

    print("[SUCCESS] PatchMaster Agent installed.")
    print(f"[INFO] Install dir: {install_dir}")
    print("[INFO] Services: PatchMaster-Agent, PatchMaster-Agent-Heartbeat")
    if wbadmin_target:
        print(f"[INFO] wbadmin target configured: {wbadmin_target}")
    if not args.no_pause:
        input("Press Enter to exit...")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
