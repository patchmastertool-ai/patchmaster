import sys
import os
import site
import zipfile
import importlib
import base64
import secrets
from pathlib import Path
from datetime import datetime, timezone

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TESTDEPS_DIR = PROJECT_ROOT / "vendor" / "python-testdeps-flat"
TEST_WHEELS = [
    "colorama-0.4.6-py2.py3-none-any.whl",
    "iniconfig-2.3.0-py3-none-any.whl",
    "packaging-26.0-py3-none-any.whl",
    "pluggy-1.6.0-py3-none-any.whl",
    "pygments-2.19.2-py3-none-any.whl",
    "pytest-8.4.2-py3-none-any.whl",
]


def ensure_required_runtime_env():
    if not os.getenv("LICENSE_SIGN_KEY"):
        os.environ["LICENSE_SIGN_KEY"] = secrets.token_hex(32)
        print("[run_tests] LICENSE_SIGN_KEY not set; using an ephemeral test key.")
    if not os.getenv("PM_SECRET_KEY"):
        os.environ["PM_SECRET_KEY"] = base64.urlsafe_b64encode(
            secrets.token_bytes(32)
        ).decode()
        print("[run_tests] PM_SECRET_KEY not set; using an ephemeral test key.")


def _wheel_dirs():
    return [
        PROJECT_ROOT / "vendor" / "wheels",
        PROJECT_ROOT / "backend" / "static" / "agent-deps" / "wheels",
    ]


def _wheel_looks_compatible(path: Path) -> bool:
    name = path.name.lower()
    py_tag = f"cp{sys.version_info.major}{sys.version_info.minor}"
    if "win_amd64" in name and os.name != "nt":
        return False
    if ("manylinux" in name or "linux" in name) and os.name == "nt":
        return False
    if any(tag in name for tag in ("cp310", "cp311", "cp312", "cp313", "cp314")):
        if "abi3" in name:
            return True
        return py_tag in name
    return True


def ensure_bundled_pytest():
    if (TESTDEPS_DIR / "pytest" / "__init__.py").is_file():
        return True
    TESTDEPS_DIR.mkdir(parents=True, exist_ok=True)
    for wheels_dir in _wheel_dirs():
        if not all((wheels_dir / wheel).is_file() for wheel in TEST_WHEELS):
            continue
        try:
            for wheel in TEST_WHEELS:
                with zipfile.ZipFile(wheels_dir / wheel) as zf:
                    zf.extractall(TESTDEPS_DIR)
            if (TESTDEPS_DIR / "pytest" / "__init__.py").is_file():
                return True
        except Exception:
            continue
    return False


def ensure_user_site_on_path():
    extra_paths = []
    if (TESTDEPS_DIR / "pytest" / "__init__.py").is_file():
        extra_paths.append(TESTDEPS_DIR)
    else:
        for candidate in (
            TESTDEPS_DIR,
            PROJECT_ROOT / "vendor" / "python-testdeps",
        ):
            try:
                if candidate.exists() and os.access(candidate, os.R_OK | os.X_OK):
                    extra_paths.append(candidate)
            except Exception:
                continue
    try:
        user_site = site.getusersitepackages()
    except Exception:
        user_site = None
    if user_site:
        extra_paths.append(Path(user_site))
    for path in reversed(extra_paths):
        path_str = str(path)
        if path_str and path_str not in sys.path and Path(path_str).exists():
            sys.path.insert(0, path_str)

def ensure_pytest():
    ensure_bundled_pytest()
    ensure_user_site_on_path()
    try:
        import pytest  # noqa: F401
        return True
    except ImportError:
        print("[run_tests] pytest is not installed in this Python environment.")
        print("[run_tests] Activate the project venv or install backend test dependencies first.")
        return False


def _add_wheel_to_path(prefix: str) -> bool:
    for wheels_dir in _wheel_dirs():
        matches = sorted(path for path in wheels_dir.glob(f"{prefix}-*.whl") if _wheel_looks_compatible(path))
        if not matches:
            continue
        wheel_path = str(matches[-1])
        if wheel_path not in sys.path:
            sys.path.insert(0, wheel_path)
        return True
    return False


def _ensure_module(module_name: str, wheel_prefix: str) -> bool:
    try:
        importlib.import_module(module_name)
        return True
    except Exception:
        pass
    _add_wheel_to_path(wheel_prefix)
    try:
        importlib.import_module(module_name)
        return True
    except Exception:
        return False


def ensure_backend_runtime_modules() -> bool:
    ensure_user_site_on_path()
    checks = [
        ("jwt", "PyJWT"),
        ("fastapi", "fastapi"),
        ("httpx", "httpx"),
        ("sqlalchemy", "sqlalchemy"),
        ("passlib", "passlib"),
    ]
    ok = True
    for module_name, wheel_prefix in checks:
        if not _ensure_module(module_name, wheel_prefix):
            print(f"[run_tests] Missing runtime dependency: {module_name}")
            ok = False
    return ok


def _vendor_test_missing_dependencies() -> list[str]:
    missing = []
    checks = [
        ("flask", "Flask"),
        ("flask_wtf", "Flask-WTF"),
    ]
    for module_name, package_name in checks:
        try:
            __import__(module_name)
        except Exception:
            missing.append(package_name)
    return missing


def run_pytest(junit_xml_path: str | None = None):
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    backend_tests = os.path.join(project_root, "backend", "tests")
    vendor_tests = os.path.join(project_root, "vendor", "tests")
    args = []
    if os.path.isdir(backend_tests):
        args.append(backend_tests)
    missing_vendor_deps = _vendor_test_missing_dependencies()
    if os.path.isdir(vendor_tests) and not missing_vendor_deps:
        args.append(vendor_tests)
    elif os.path.isdir(vendor_tests):
        print(f"[run_tests] Skipping vendor tests (missing vendor dependencies: {', '.join(missing_vendor_deps)}).")
    if not args:
        print("[run_tests] No test directories found; skipping.")
        return True
    # Ensure backend package is importable (license.py, etc.)
    if project_root not in sys.path:
        sys.path.insert(0, project_root)
    backend_path = Path(project_root) / "backend"
    if str(backend_path) not in sys.path:
        sys.path.insert(0, str(backend_path))
    import pytest
    live_mode = (os.getenv("PM_TEST_LIVE", "1") or "1").strip() != "0"
    if live_mode:
        args = args + ["-vv", "-ra", "--durations=15", "-o", "console_output_style=progress"]
    else:
        args = args + ["-q"]
    if junit_xml_path:
        args = args + [f"--junitxml={junit_xml_path}"]
    print(f"[run_tests] pytest args: {' '.join(args)}")
    return pytest.main(args) == 0

if __name__ == "__main__":
    ensure_required_runtime_env()
    if not ensure_pytest():
        sys.exit(1)
    if not ensure_backend_runtime_modules():
        print("[run_tests] Backend runtime dependencies are incomplete for test collection.")
        sys.exit(1)

    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    run_id = os.getenv("REPORT_RUN_ID") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    reports_dir = Path(project_root) / "reports" / "pytest" / run_id
    reports_dir.mkdir(parents=True, exist_ok=True)
    junit_path = reports_dir / "backend-junit.xml"

    ok = run_pytest(junit_xml_path=str(junit_path))
    sys.exit(0 if ok else 1)
