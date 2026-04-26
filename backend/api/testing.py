"""Testing control API for backend/frontend verification runs."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import threading
import zipfile
import importlib.machinery
import importlib.util
import site
from urllib import error as urlerror
from urllib import parse as urlparse
from urllib import request as urlrequest
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from auth import get_current_user
from api.auth_api import get_effective_permissions
from api.ops_queue import enqueue_operation

router = APIRouter(prefix="/api/testing", tags=["Testing"])

PROJECT_ROOT = Path(__file__).resolve().parents[2]
REPORTS_ROOT = PROJECT_ROOT / "reports" / "testing"
REPORTS_ROOT.mkdir(parents=True, exist_ok=True)

_RUN_LOCK = threading.Lock()
_RUNS: dict[str, dict[str, Any]] = {}
_ACTIVE_RUN_ID: str | None = None
_RUNTIME_CONFIG: dict[str, str] = {}
TESTING_CONFIG_PATH = REPORTS_ROOT / "config.json"

_CONFIG_ENV_KEYS = {
    "external_frontend_url": "TESTING_EXTERNAL_FRONTEND_URL",
    "external_frontend_expect_text": "TESTING_EXTERNAL_FRONTEND_EXPECT_TEXT",
    "external_frontend_expect_status": "TESTING_EXTERNAL_FRONTEND_EXPECT_STATUS",
    "external_frontend_paths": "TESTING_EXTERNAL_FRONTEND_PATHS",
    "external_backend_url": "TESTING_EXTERNAL_BACKEND_URL",
    "external_backend_health_path": "TESTING_EXTERNAL_BACKEND_HEALTH_PATH",
    "external_backend_expect_field": "TESTING_EXTERNAL_BACKEND_EXPECT_FIELD",
    "external_backend_expect_value": "TESTING_EXTERNAL_BACKEND_EXPECT_VALUE",
    "external_backend_expect_status": "TESTING_EXTERNAL_BACKEND_EXPECT_STATUS",
    "external_timeout_seconds": "TESTING_EXTERNAL_TIMEOUT_SECONDS",
}


def _load_persisted_runtime_config() -> None:
    if not TESTING_CONFIG_PATH.is_file():
        return
    try:
        data = json.loads(TESTING_CONFIG_PATH.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return
        for env_key in _CONFIG_ENV_KEYS.values():
            value = str(data.get(env_key) or "").strip()
            if not value:
                continue
            _RUNTIME_CONFIG[env_key] = value
            os.environ[env_key] = value
    except Exception:
        return


def _persist_runtime_config() -> None:
    try:
        payload = {env_key: (_RUNTIME_CONFIG.get(env_key) or "").strip() for env_key in _CONFIG_ENV_KEYS.values()}
        TESTING_CONFIG_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    except Exception:
        return


_load_persisted_runtime_config()

_TARGETS = {
    "backend": {
        "label": "External Backend/API Check",
        "description": "Validates an external backend endpoint and optional health payload fields.",
        "runner": "external_backend",
    },
    "frontend": {
        "label": "External Frontend Check",
        "description": "Validates an external website URL with status and optional content assertions.",
        "runner": "external_frontend",
    },
    "frontend-e2e": {
        "label": "External Frontend Path Journey",
        "description": "Checks multiple external website paths for expected HTTP status and optional content match.",
        "runner": "external_frontend_e2e",
    },
    "quality": {
        "label": "External Full Suite",
        "description": "Runs external frontend and backend checks together and writes a combined summary.",
        "runner": "external_quality",
    },
}
_BUNDLED_PYTEST_WHEELS = [
    "colorama-0.4.6-py2.py3-none-any.whl",
    "iniconfig-2.3.0-py3-none-any.whl",
    "packaging-26.0-py3-none-any.whl",
    "pluggy-1.6.0-py3-none-any.whl",
    "pygments-2.19.2-py3-none-any.whl",
    "pytest-8.4.2-py3-none-any.whl",
]


def _wheel_dirs() -> list[Path]:
    return [
        PROJECT_ROOT / "vendor" / "wheels",
        PROJECT_ROOT / "backend" / "static" / "agent-deps" / "wheels",
    ]


class StartRunRequest(BaseModel):
    target: str


class TestingConfigRequest(BaseModel):
    external_frontend_url: str | None = None
    external_frontend_expect_text: str | None = None
    external_frontend_expect_status: str | None = None
    external_frontend_paths: str | None = None
    external_backend_url: str | None = None
    external_backend_health_path: str | None = None
    external_backend_expect_field: str | None = None
    external_backend_expect_value: str | None = None
    external_backend_expect_status: str | None = None
    external_timeout_seconds: str | None = None


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _utc_stamp(ts: datetime | None = None) -> str:
    return (ts or _now_utc()).strftime("%Y-%m-%dT%H:%M:%SZ")


def _run_id_for(target: str) -> str:
    return f"{target}-{_now_utc().strftime('%Y-%m-%dT%H-%M-%SZ')}"


def _run_dir(run_id: str) -> Path:
    return REPORTS_ROOT / run_id


def _run_meta_path(run_id: str) -> Path:
    return _run_dir(run_id) / "summary.json"


def _run_log_path(run_id: str) -> Path:
    return _run_dir(run_id) / "console.log"


def _target_artifacts(target: str, run_id: str) -> list[str]:
    return [f"reports/testing/{run_id}/external-summary.json"]


def _npm_available() -> bool:
    return any(shutil.which(name) for name in ("npm", "npm.cmd", "npm.exe"))


def _frontend_tooling_ready() -> tuple[bool, str | None]:
    frontend_root = PROJECT_ROOT / "frontend"
    if not frontend_root.is_dir():
        return False, "frontend workspace is missing on this server."
    if not (frontend_root / "package.json").is_file():
        return False, "frontend package.json is missing on this server."
    if not (frontend_root / "playwright.config.js").is_file():
        return False, "Playwright config is missing on this server."
    if not (frontend_root / "node_modules" / "@playwright" / "test").exists():
        return False, "frontend Playwright dependencies are not installed on this server."
    browsers_path = (os.getenv("PLAYWRIGHT_BROWSERS_PATH") or "").strip()
    if browsers_path and not Path(browsers_path).exists():
        return False, f"Playwright browser bundle is missing at {browsers_path}."
    return True, None


def _bundled_pytest_ready() -> bool:
    extracted = PROJECT_ROOT / "vendor" / "python-testdeps-flat" / "pytest" / "__init__.py"
    if extracted.is_file():
        return True
    for wheels_dir in _wheel_dirs():
        if all((wheels_dir / wheel).is_file() for wheel in _BUNDLED_PYTEST_WHEELS):
            return True
    return False


def _extract_bundled_pytest() -> bool:
    extracted = PROJECT_ROOT / "vendor" / "python-testdeps-flat" / "pytest" / "__init__.py"
    if extracted.is_file():
        return True
    target_dir = PROJECT_ROOT / "vendor" / "python-testdeps-flat"
    target_dir.mkdir(parents=True, exist_ok=True)
    for wheels_dir in _wheel_dirs():
        if not all((wheels_dir / wheel).is_file() for wheel in _BUNDLED_PYTEST_WHEELS):
            continue
        try:
            for wheel in _BUNDLED_PYTEST_WHEELS:
                with zipfile.ZipFile(wheels_dir / wheel) as zf:
                    zf.extractall(target_dir)
            return (target_dir / "pytest" / "__init__.py").is_file()
        except Exception:
            continue
    return False


def _module_available(module_name: str) -> bool:
    search_paths = list(sys.path)
    bundled_paths = []
    flat_testdeps = PROJECT_ROOT / "vendor" / "python-testdeps-flat"
    if (flat_testdeps / "pytest" / "__init__.py").is_file():
        bundled_paths.append(flat_testdeps)
    else:
        for bundled_testdeps in (
            flat_testdeps,
            PROJECT_ROOT / "vendor" / "python-testdeps",
        ):
            try:
                if bundled_testdeps.exists() and os.access(bundled_testdeps, os.R_OK | os.X_OK):
                    bundled_paths.append(bundled_testdeps)
            except Exception:
                continue
    for bundled_testdeps in bundled_paths:
        search_paths.insert(0, str(bundled_testdeps))
    try:
        user_site = site.getusersitepackages()
    except Exception:
        user_site = None
    if user_site and user_site not in search_paths:
        search_paths.insert(0, user_site)
    return importlib.util.find_spec(module_name) is not None or importlib.machinery.PathFinder.find_spec(module_name, search_paths) is not None


def _wheel_contains_prefix(prefix: str) -> bool:
    for wheels_dir in _wheel_dirs():
        if not wheels_dir.is_dir():
            continue
        if any(wheels_dir.glob(f"{prefix}-*.whl")):
            return True
    return False


def _backend_test_runtime_readiness() -> tuple[bool, list[str]]:
    notes: list[str] = []
    if not _module_available("pytest"):
        if not _extract_bundled_pytest() and not _bundled_pytest_ready():
            notes.append("pytest is not installed and bundled pytest wheels were not found in vendor/wheels or backend/static/agent-deps/wheels.")
            return False, notes
    missing_runtime: list[str] = []
    for module_name, wheel_prefix in (
        ("fastapi", "fastapi"),
        ("httpx", "httpx"),
        ("sqlalchemy", "sqlalchemy"),
        ("jwt", "PyJWT"),
    ):
        if _module_available(module_name):
            continue
        if not _wheel_contains_prefix(wheel_prefix):
            missing_runtime.append(module_name)
    if missing_runtime:
        notes.append(
            "backend runtime test dependencies are missing wheels: " + ", ".join(sorted(set(missing_runtime))) + "."
        )
        return False, notes
    return True, notes


def _real_backend_smoke_env() -> dict[str, str]:
    return {
        "base_url": (os.getenv("PLAYWRIGHT_REAL_BASE_URL") or "").strip(),
        "username": (os.getenv("PLAYWRIGHT_REAL_USER") or "").strip(),
        "password": (os.getenv("PLAYWRIGHT_REAL_PASSWORD") or "").strip(),
    }


def _config_value(env_key: str) -> str:
    if env_key in _RUNTIME_CONFIG:
        return (_RUNTIME_CONFIG.get(env_key) or "").strip()
    return (os.getenv(env_key) or "").strip()


def _testing_config_snapshot() -> dict[str, str | None]:
    return {
        "external_frontend_url": _config_value(_CONFIG_ENV_KEYS["external_frontend_url"]) or None,
        "external_frontend_expect_text": _config_value(_CONFIG_ENV_KEYS["external_frontend_expect_text"]) or None,
        "external_frontend_expect_status": _config_value(_CONFIG_ENV_KEYS["external_frontend_expect_status"]) or None,
        "external_frontend_paths": _config_value(_CONFIG_ENV_KEYS["external_frontend_paths"]) or None,
        "external_backend_url": _config_value(_CONFIG_ENV_KEYS["external_backend_url"]) or None,
        "external_backend_health_path": _config_value(_CONFIG_ENV_KEYS["external_backend_health_path"]) or None,
        "external_backend_expect_field": _config_value(_CONFIG_ENV_KEYS["external_backend_expect_field"]) or None,
        "external_backend_expect_value": _config_value(_CONFIG_ENV_KEYS["external_backend_expect_value"]) or None,
        "external_backend_expect_status": _config_value(_CONFIG_ENV_KEYS["external_backend_expect_status"]) or None,
        "external_timeout_seconds": _config_value(_CONFIG_ENV_KEYS["external_timeout_seconds"]) or None,
    }


def _apply_testing_config(payload: TestingConfigRequest) -> dict[str, str | None]:
    updates = payload.model_dump()
    for field, env_key in _CONFIG_ENV_KEYS.items():
        if field not in updates:
            continue
        raw_value = updates[field]
        value = (raw_value or "").strip()
        _RUNTIME_CONFIG[env_key] = value
        if value:
            os.environ[env_key] = value
        elif env_key in os.environ:
            del os.environ[env_key]
    _persist_runtime_config()
    return _testing_config_snapshot()


def _external_frontend_env() -> dict[str, str]:
    return {
        "url": _config_value("TESTING_EXTERNAL_FRONTEND_URL"),
        "expect_text": _config_value("TESTING_EXTERNAL_FRONTEND_EXPECT_TEXT"),
        "expect_status": _config_value("TESTING_EXTERNAL_FRONTEND_EXPECT_STATUS"),
        "paths": _config_value("TESTING_EXTERNAL_FRONTEND_PATHS") or "/",
    }


def _external_backend_env() -> dict[str, str]:
    return {
        "url": _config_value("TESTING_EXTERNAL_BACKEND_URL"),
        "health_path": _config_value("TESTING_EXTERNAL_BACKEND_HEALTH_PATH") or "/health",
        "expect_field": _config_value("TESTING_EXTERNAL_BACKEND_EXPECT_FIELD") or "status",
        "expect_value": _config_value("TESTING_EXTERNAL_BACKEND_EXPECT_VALUE") or "ok",
        "expect_status": _config_value("TESTING_EXTERNAL_BACKEND_EXPECT_STATUS"),
    }


def _parse_expected_statuses(raw: str, defaults: list[int]) -> set[int]:
    parsed: set[int] = set()
    for token in (raw or "").split(","):
        token = token.strip()
        if not token:
            continue
        if token.endswith("xx") and len(token) == 3 and token[0].isdigit():
            hundred = int(token[0]) * 100
            parsed.update(range(hundred, hundred + 100))
            continue
        if token.isdigit():
            parsed.add(int(token))
    return parsed or set(defaults)


def _http_get(url: str, timeout: float = 20.0) -> tuple[int, str]:
    req = urlrequest.Request(url, method="GET", headers={"User-Agent": "PatchMaster-TestingCenter/1.0"})
    with urlrequest.urlopen(req, timeout=timeout) as resp:
        status = int(getattr(resp, "status", 200))
        body = resp.read().decode("utf-8", errors="replace")
        return status, body


def _combine_url(base_url: str, path_value: str) -> str:
    base = (base_url or "").strip()
    if not base:
        return ""
    if (path_value or "").startswith("http://") or (path_value or "").startswith("https://"):
        return path_value
    normalized_base = base if base.endswith("/") else f"{base}/"
    normalized_path = (path_value or "").lstrip("/")
    return urlparse.urljoin(normalized_base, normalized_path)


def _probe_frontend_target(log_file, cfg: dict[str, str], include_paths: bool) -> tuple[bool, dict[str, Any]]:
    timeout = float(_config_value("TESTING_EXTERNAL_TIMEOUT_SECONDS") or "20")
    expected_status = _parse_expected_statuses(cfg.get("expect_status") or "", [200, 301, 302, 307, 308])
    url = cfg.get("url") or ""
    expect_text = cfg.get("expect_text") or ""
    paths = [p.strip() for p in (cfg.get("paths") or "/").split(",") if p.strip()] if include_paths else ["/"]
    summary: dict[str, Any] = {
        "target": "frontend-e2e" if include_paths else "frontend",
        "base_url": url,
        "expect_text": expect_text or None,
        "expected_status": sorted(expected_status),
        "checks": [],
    }
    if not url:
        summary["error"] = "Missing TESTING_EXTERNAL_FRONTEND_URL."
        log_file.write("[testing-center] Missing TESTING_EXTERNAL_FRONTEND_URL\n")
        return False, summary
    all_ok = True
    for path_value in paths:
        full_url = _combine_url(url, path_value)
        check: dict[str, Any] = {"url": full_url, "path": path_value}
        try:
            status, body = _http_get(full_url, timeout=timeout)
            check["status"] = status
            check["status_ok"] = status in expected_status
            if expect_text:
                check["contains_expect_text"] = expect_text.lower() in body.lower()
            else:
                check["contains_expect_text"] = True
            check["ok"] = bool(check["status_ok"] and check["contains_expect_text"])
            all_ok = all_ok and bool(check["ok"])
            log_file.write(f"[testing-center] GET {full_url} -> {status}\n")
        except Exception as exc:
            check["ok"] = False
            check["error"] = str(exc)
            all_ok = False
            log_file.write(f"[testing-center] GET {full_url} failed: {exc}\n")
        summary["checks"].append(check)
        log_file.flush()
    summary["ok"] = all_ok
    return all_ok, summary


def _probe_backend_target(log_file, cfg: dict[str, str]) -> tuple[bool, dict[str, Any]]:
    timeout = float(_config_value("TESTING_EXTERNAL_TIMEOUT_SECONDS") or "20")
    expected_status = _parse_expected_statuses(cfg.get("expect_status") or "", [200, 204])
    base_url = cfg.get("url") or ""
    health_path = cfg.get("health_path") or "/health"
    expect_field = cfg.get("expect_field") or ""
    expect_value = cfg.get("expect_value") or ""
    summary: dict[str, Any] = {
        "target": "backend",
        "base_url": base_url,
        "health_path": health_path,
        "expect_field": expect_field or None,
        "expect_value": expect_value or None,
        "expected_status": sorted(expected_status),
    }
    if not base_url:
        summary["error"] = "Missing TESTING_EXTERNAL_BACKEND_URL."
        log_file.write("[testing-center] Missing TESTING_EXTERNAL_BACKEND_URL\n")
        return False, summary
    full_url = _combine_url(base_url, health_path)
    summary["url"] = full_url
    try:
        status, body = _http_get(full_url, timeout=timeout)
        summary["status"] = status
        status_ok = status in expected_status
        summary["status_ok"] = status_ok
        log_file.write(f"[testing-center] GET {full_url} -> {status}\n")
        payload = None
        try:
            payload = json.loads(body)
        except Exception:
            payload = None
        summary["json"] = payload
        field_ok = True
        if expect_field and expect_value:
            if isinstance(payload, dict):
                actual = payload.get(expect_field)
                field_ok = str(actual).strip().lower() == expect_value.strip().lower()
                summary["actual_field_value"] = actual
            else:
                field_ok = False
        summary["field_ok"] = field_ok
        summary["ok"] = bool(status_ok and field_ok)
        return bool(summary["ok"]), summary
    except urlerror.HTTPError as exc:
        summary["status"] = int(exc.code)
        summary["status_ok"] = int(exc.code) in expected_status
        summary["field_ok"] = False
        summary["ok"] = False
        summary["error"] = str(exc)
        log_file.write(f"[testing-center] GET {full_url} failed: {exc}\n")
        return False, summary
    except Exception as exc:
        summary["status_ok"] = False
        summary["field_ok"] = False
        summary["ok"] = False
        summary["error"] = str(exc)
        log_file.write(f"[testing-center] GET {full_url} failed: {exc}\n")
        return False, summary


def _run_external_runner(target: str, run_dir: Path, log_file) -> int:
    frontend_cfg = _external_frontend_env()
    backend_cfg = _external_backend_env()
    summary_path = run_dir / "external-summary.json"
    if target == "frontend":
        ok, summary = _probe_frontend_target(log_file, frontend_cfg, include_paths=False)
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
        return 0 if ok else 1
    if target == "frontend-e2e":
        ok, summary = _probe_frontend_target(log_file, frontend_cfg, include_paths=True)
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
        return 0 if ok else 1
    if target == "backend":
        ok, summary = _probe_backend_target(log_file, backend_cfg)
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
        return 0 if ok else 1
    if target == "quality":
        frontend_ok, frontend_summary = _probe_frontend_target(log_file, frontend_cfg, include_paths=True)
        backend_ok, backend_summary = _probe_backend_target(log_file, backend_cfg)
        summary = {
            "target": "quality",
            "frontend": frontend_summary,
            "backend": backend_summary,
            "ok": bool(frontend_ok and backend_ok),
        }
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
        return 0 if summary["ok"] else 1
    log_file.write(f"[testing-center] Unsupported external target: {target}\n")
    summary_path.write_text(json.dumps({"target": target, "ok": False, "error": "Unsupported target"}, indent=2), encoding="utf-8")
    return 1


def _target_status(target: str) -> dict[str, Any]:
    status = {
        "key": target,
        "label": _TARGETS[target]["label"],
        "description": _TARGETS[target]["description"],
        "available": True,
        "notes": [],
    }
    external_frontend = _external_frontend_env()
    external_backend = _external_backend_env()
    if target in {"frontend", "frontend-e2e", "quality"} and not external_frontend["url"]:
        status["available"] = False
        status["notes"].append("Set TESTING_EXTERNAL_FRONTEND_URL to enable external website checks.")
    if target in {"backend", "quality"} and not external_backend["url"]:
        status["available"] = False
        status["notes"].append("Set TESTING_EXTERNAL_BACKEND_URL to enable external API checks.")
    if target in {"frontend", "frontend-e2e"} and external_frontend["url"]:
        status["notes"].append(f"External frontend target: {external_frontend['url']}")
    if target in {"backend"} and external_backend["url"]:
        status["notes"].append(f"External backend target: {external_backend['url']}")
    if target == "quality" and external_frontend["url"] and external_backend["url"]:
        status["notes"].append("External frontend and backend targets are configured.")
    return status


def _public_run_record(record: dict[str, Any]) -> dict[str, Any]:
    public = dict(record)
    tail = public.get("log_tail")
    if isinstance(tail, deque):
        public["log_tail"] = "".join(tail)
    public["artifacts"] = list(public.get("artifacts", []))
    return public


def _persist_record(record: dict[str, Any]) -> None:
    run_dir = _run_dir(record["run_id"])
    run_dir.mkdir(parents=True, exist_ok=True)
    serializable = _public_run_record(record)
    _run_meta_path(record["run_id"]).write_text(json.dumps(serializable, indent=2), encoding="utf-8")


def _read_log_tail(run_id: str, max_lines: int = 80) -> str:
    log_path = _run_log_path(run_id)
    if not log_path.is_file():
        return ""
    lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
    return "\n".join(lines[-max_lines:])


def _load_saved_runs(limit: int = 12) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for meta_path in sorted(REPORTS_ROOT.glob("*/summary.json"), key=lambda item: item.stat().st_mtime, reverse=True):
        try:
            record = json.loads(meta_path.read_text(encoding="utf-8"))
            record["log_tail"] = _read_log_tail(record["run_id"])
            records.append(record)
        except Exception:
            continue
        if len(records) >= limit:
            break
    return records


def _final_status(return_code: int) -> str:
    return "passed" if return_code == 0 else "failed"


def _run_worker(run_id: str, target: str) -> None:
    global _ACTIVE_RUN_ID

    config = _TARGETS[target]
    run_dir = _run_dir(run_id)
    run_dir.mkdir(parents=True, exist_ok=True)
    log_path = _run_log_path(run_id)
    with _RUN_LOCK:
        record = _RUNS[run_id]
        record["status"] = "running"
        record["started_at"] = _utc_stamp()
        _persist_record(record)

    with log_path.open("w", encoding="utf-8", errors="replace") as log_file:
        try:
            runner = str(config.get("runner") or "subprocess")
            if runner.startswith("external_"):
                return_code = _run_external_runner(target, run_dir, log_file)
                with _RUN_LOCK:
                    record = _RUNS[run_id]
                    record["log_tail"] = deque(_read_log_tail(run_id).splitlines(keepends=True), maxlen=120)
            else:
                env = os.environ.copy()
                env["REPORT_RUN_ID"] = run_id
                env.setdefault("PYTHONUNBUFFERED", "1")
                env.setdefault("CI", "1")
                creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0
                proc = subprocess.Popen(
                    config["command"],
                    cwd=config["cwd"],
                    env=env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    creationflags=creationflags,
                )
                with _RUN_LOCK:
                    record = _RUNS[run_id]
                    record["pid"] = proc.pid
                    _persist_record(record)

                assert proc.stdout is not None
                for line in proc.stdout:
                    log_file.write(line)
                    log_file.flush()
                    with _RUN_LOCK:
                        record = _RUNS[run_id]
                        record["log_tail"].append(line)

                return_code = proc.wait()
        except Exception as exc:
            return_code = 1
            message = f"[testing-center] Failed to start run: {exc}\n"
            log_file.write(message)
            with _RUN_LOCK:
                record = _RUNS[run_id]
                record["log_tail"].append(message)

    finished_at = _now_utc()
    with _RUN_LOCK:
        record = _RUNS[run_id]
        started = datetime.fromisoformat(record["started_at"].replace("Z", "+00:00"))
        record["status"] = _final_status(return_code)
        record["return_code"] = return_code
        record["finished_at"] = _utc_stamp(finished_at)
        record["duration_seconds"] = round((finished_at - started).total_seconds(), 2)
        record["artifacts"] = _target_artifacts(target, run_id)
        record["log_tail"] = deque(record["log_tail"], maxlen=120)
        _persist_record(record)
        _ACTIVE_RUN_ID = None


def _require_testing_access(user=Depends(get_current_user)):
    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    perms = get_effective_permissions(role, getattr(user, "custom_permissions", None))
    if not perms.get("testing"):
        raise HTTPException(status_code=403, detail="Testing Center access is not enabled for this user.")
    return user


@router.get("/overview")
async def testing_overview(user=Depends(_require_testing_access)):
    real_backend = _real_backend_smoke_env()
    external_frontend = _external_frontend_env()
    external_backend = _external_backend_env()
    with _RUN_LOCK:
        active_run = _public_run_record(_RUNS[_ACTIVE_RUN_ID]) if _ACTIVE_RUN_ID and _ACTIVE_RUN_ID in _RUNS else None
        live_runs = {run_id: _public_run_record(record) for run_id, record in _RUNS.items()}

    recent_runs = []
    seen = set()
    for record in ([active_run] if active_run else []) + sorted(live_runs.values(), key=lambda item: item.get("requested_at", ""), reverse=True):
        if not record:
            continue
        seen.add(record["run_id"])
        recent_runs.append(record)
    for record in _load_saved_runs():
        if record["run_id"] in seen:
            continue
        recent_runs.append(record)
        seen.add(record["run_id"])
        if len(recent_runs) >= 12:
            break

    return {
        "active_run": active_run,
        "recent_runs": recent_runs[:12],
        "targets": [_target_status(target) for target in _TARGETS],
        "environment": {
            "python": sys.executable,
            "npm_available": _npm_available(),
            "reports_root": str(REPORTS_ROOT),
            "playwright_real_backend_smoke": bool(all(real_backend.values())),
            "playwright_real_backend_target": real_backend["base_url"] or None,
            "external_frontend_target": external_frontend["url"] or None,
            "external_backend_target": external_backend["url"] or None,
            "testing_config": _testing_config_snapshot(),
        },
    }


@router.get("/config")
async def get_testing_config(user=Depends(_require_testing_access)):
    return {"config": _testing_config_snapshot()}


@router.put("/config")
async def update_testing_config(body: TestingConfigRequest, user=Depends(_require_testing_access)):
    return {"config": _apply_testing_config(body)}


@router.get("/runs/{run_id}")
async def testing_run_detail(run_id: str, user=Depends(_require_testing_access)):
    with _RUN_LOCK:
        if run_id in _RUNS:
            record = _public_run_record(_RUNS[run_id])
            return record

    meta_path = _run_meta_path(run_id)
    if not meta_path.is_file():
        raise HTTPException(status_code=404, detail="Test run not found")

    record = json.loads(meta_path.read_text(encoding="utf-8"))
    record["log_tail"] = _read_log_tail(run_id)
    return record


@router.post("/run")
async def start_testing_run(
    body: StartRunRequest,
    request: Request,
    wait: bool = Query(False),
    user=Depends(_require_testing_access),
):
    global _ACTIVE_RUN_ID

    target = body.target.strip().lower()
    if target not in _TARGETS:
        raise HTTPException(status_code=400, detail="Unsupported test target")
    target_state = _target_status(target)
    if not target_state["available"]:
        raise HTTPException(status_code=400, detail=" ".join(target_state["notes"]) or "Selected test target is not ready.")

    with _RUN_LOCK:
        if _ACTIVE_RUN_ID and _ACTIVE_RUN_ID in _RUNS and _RUNS[_ACTIVE_RUN_ID]["status"] == "running":
            active = _public_run_record(_RUNS[_ACTIVE_RUN_ID])
            raise HTTPException(
                status_code=409,
                detail=f"{active['label']} is already running. Wait for it to finish before starting another run.",
            )

        run_id = _run_id_for(target)
        record = {
            "run_id": run_id,
            "target": target,
            "label": _TARGETS[target]["label"],
            "description": _TARGETS[target]["description"],
            "status": "queued",
            "requested_at": _utc_stamp(),
            "requested_by": getattr(user, "username", "unknown"),
            "return_code": None,
            "pid": None,
            "started_at": None,
            "finished_at": None,
            "duration_seconds": None,
            "artifacts": _target_artifacts(target, run_id),
            "log_tail": deque(maxlen=120),
        }
        _RUNS[run_id] = record
        _ACTIVE_RUN_ID = run_id
        _persist_record(record)

    if wait:
        await asyncio.to_thread(_run_worker, run_id, target)
        return _public_run_record(record)
    request_id = str(getattr(getattr(request, "state", object()), "request_id", "") or "")
    trace_token = str(getattr(getattr(request, "state", object()), "trace_token", "") or "")
    async def _runner():
        await asyncio.to_thread(_run_worker, run_id, target)
        return {"run_id": run_id, "target": target}
    queue_job = await enqueue_operation(
        op_type="testing.run",
        payload={"run_id": run_id, "target": target},
        runner=_runner,
        requested_by=getattr(user, "username", "unknown"),
        request_id=request_id or None,
        trace_token=trace_token or None,
    )
    response = _public_run_record(record)
    response["queue_job"] = queue_job
    return response
