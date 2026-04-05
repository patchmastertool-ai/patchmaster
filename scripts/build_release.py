#!/usr/bin/env python3
import base64
import os
import shutil
import tarfile
import hashlib
import tempfile
import stat
import sys
import subprocess
import importlib.util
import venv
import fnmatch
import time

# Defer cryptography imports until after bootstrap - imported in functions that need them
# from cryptography.hazmat.primitives import serialization
# from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
# from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey



VERSION = "2.0.0"
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.environ.get("DIST_DIR", os.path.join(PROJECT_ROOT, "dist"))
VENDOR_DIST_DIR = os.path.join(PROJECT_ROOT, "vendor", "dist")
PRIVATE_DIST_DIR = os.path.join(DIST_DIR, "private")
DEVELOPER_DIST_DIR = os.path.join(DIST_DIR, "developer")
RELEASE_PROFILE = (os.environ.get("PM_RELEASE_PROFILE", "lean") or "lean").strip().lower()
BOOTSTRAP_MARKER = "PM_RELEASE_BOOTSTRAPPED"
REQUIRED_MODULES = (
    "fastapi",
    "sqlalchemy",
    "httpx",
    "flask",
    "jwt",
    "passlib",
    "cryptography",
)
DEFAULT_RELEASE_VENV = os.path.join(PROJECT_ROOT, ".build-release-venv")
FAIL_ON_MISSING = (os.environ.get("PM_FAIL_ON_MISSING", "1") or "1").strip() != "0"
PDF_OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output", "pdf")
GUIDE_PDFS = (
    f"PatchMaster_Customer_User_Guide_v{VERSION}.pdf",
    f"PatchMaster_Developer_Guide_v{VERSION}.pdf",
    f"PatchMaster_Support_Runbook_v{VERSION}.pdf",
)
AUTHORITY_FILE_CANDIDATES = (
    os.path.join(PROJECT_ROOT, ".license-authority.env"),
    os.path.join(PROJECT_ROOT, "patchmaster-license-authority.env"),
)
AUTHORITY_BUNDLE_BASENAME = "patchmaster-license-authority.env"
PUBLIC_AUTHORITY_BUNDLE_BASENAME = "patchmaster-license-public.env"
CUSTOMER_SCRIPT_ALLOWLIST = {
    "install_patchmaster_server.sh",
    "install_patchmaster_docker.sh",
    "install_patchmaster_wsl.sh",
    "uninstall_patchmaster.sh",
}
TEST_WHEELS = (
    "colorama-0.4.6-py2.py3-none-any.whl",
    "iniconfig-2.3.0-py3-none-any.whl",
    "packaging-26.0-py3-none-any.whl",
    "pluggy-1.6.0-py3-none-any.whl",
    "pygments-2.19.2-py3-none-any.whl",
    "pytest-8.4.2-py3-none-any.whl",
)
RELEASE_AUTHORITY = {}
CUSTOMER_PRODUCT_PRUNE_PATHS = (
    "Makefile",
    "agent/Dockerfile",
    "agent/build-all.sh",
    "agent/build-rpm.sh",
    "agent/build_agent_artifacts.py",
    "agent/build_windows_iexpress_installer.py",
    "agent/dist",
    "agent/logs",
    "agent/offline-pkgs",
    "agent/patch-agent-heartbeat.spec",
    "agent/patch-agent.spec",
    "agent/patchmaster-agent-installer.spec",
    "agent/setup.py",
    "agent/snapshots",
    "agent/windows_installer.py",
    "agent/windows_installer_payload",
    "agent/windows_service",
    "backend/Dockerfile",
    "backend/pytest.ini",
    "backend/tests",
    "frontend/Dockerfile",
    "frontend/index.html",
    "frontend/nginx.conf",
    "frontend/public",
    "frontend/src",
)
DEVELOPER_BUNDLE_ITEMS = (
    "Makefile",
    "agent/Dockerfile",
    "agent/build-all.sh",
    "agent/build-rpm.sh",
    "agent/build_agent_artifacts.py",
    "agent/build_windows_iexpress_installer.py",
    "agent/patch-agent-heartbeat.spec",
    "agent/patch-agent.spec",
    "agent/patchmaster-agent-installer.spec",
    "agent/setup.py",
    "agent/windows_installer.py",
    "agent/windows_installer_payload",
    "agent/windows_service",
    "backend/Dockerfile",
    "backend/pytest.ini",
    "backend/tests",
    "frontend/Dockerfile",
    "frontend/index.html",
    "frontend/nginx.conf",
    "frontend/public",
    "frontend/src",
    "scripts",
    "docs/internal",
)
DEVELOPER_IGNORE_PATTERNS = [
    "__pycache__", "*.pyc", ".git", ".idea", ".vscode", ".pytest_cache",
    ".venv", ".venv-check", "venv", "node_modules", "dist", "reports", "test-results",
    ".build-release-venv", ".venv-vendor", "winbuild_venv", "pyi_build",
    "windows_stage", "iexpress_stage", "vendor", "-d", "=2.9.1"
]
DEVELOPER_GUIDES = (
    f"PatchMaster_Developer_Guide_v{VERSION}.pdf",
    f"PatchMaster_Support_Runbook_v{VERSION}.pdf",
)
STALE_RELEASE_OUTPUTS = (
    os.path.join(DIST_DIR, f"patchmaster-internal-docs-{VERSION}.tar.gz"),
    os.path.join(DIST_DIR, f"patchmaster-internal-docs-{VERSION}.tar.gz.sha256"),
    os.path.join(DIST_DIR, f"patchmaster-internal-docs-{VERSION}"),
    os.path.join(DIST_DIR, f"patchmaster-offline-cache-{VERSION}.tar.gz"),
    os.path.join(DIST_DIR, f"patchmaster-offline-cache-{VERSION}.tar.gz.sha256"),
    os.path.join(DEVELOPER_DIST_DIR, f"patchmaster-developer-kit-{VERSION}.tar.gz"),
    os.path.join(DEVELOPER_DIST_DIR, f"patchmaster-developer-kit-{VERSION}.tar.gz.sha256"),
    os.path.join(PRIVATE_DIST_DIR, f"patchmaster-ops-bundle-{VERSION}.tar.gz"),
    os.path.join(PRIVATE_DIST_DIR, f"patchmaster-ops-bundle-{VERSION}.tar.gz.sha256"),
    os.path.join(PRIVATE_DIST_DIR, f"patchmaster-ops-bundle-{VERSION}"),
    os.path.join(VENDOR_DIST_DIR, f"patchmaster-vendor-{VERSION}"),
    os.path.join(DIST_DIR, f"patchmaster-product-{VERSION}"),
)

def log(msg):
    print(f"[+] {msg}")

def warn(msg):
    print(f"[!] {msg}")


def _parse_simple_env(path):
    values = {}
    if not os.path.isfile(path):
        return values
    with open(path, "r", encoding="utf-8") as fh:
        for raw_line in fh:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.split("#", 1)[0].strip()
    return values


def _is_placeholder_license_key(value):
    value = (value or "").strip()
    if not value:
        return True
    lowered = value.lower()
    if lowered in {"change-me", "replace-me"}:
        return True
    if lowered.startswith("changeme-") or lowered.startswith("replace-me"):
        return True
    return value == "PatchMaster-License-SignKey-2026-Secure"


def _write_secret_file(path, lines):
    ensure_dir(os.path.dirname(path))
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(lines)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def _encode_key_bytes(raw):
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _generate_ed25519_keypair():
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    
    private_key = Ed25519PrivateKey.generate()
    private_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_bytes = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return {
        "LICENSE_SIGN_PRIVATE_KEY": _encode_key_bytes(private_bytes),
        "LICENSE_VERIFY_PUBLIC_KEY": _encode_key_bytes(public_bytes),
    }


def _generate_x25519_keypair():
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey
    
    private_key = X25519PrivateKey.generate()
    private_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_bytes = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return {
        "LICENSE_DECRYPT_PRIVATE_KEY": _encode_key_bytes(private_bytes),
        "LICENSE_ENCRYPT_PUBLIC_KEY": _encode_key_bytes(public_bytes),
    }


def _authority_full_env_text(authority):
    return (
        "# Operator-only authority bundle. Keep this file outside customer-visible packages.\n"
        f"LICENSE_SIGN_KEY={authority['LICENSE_SIGN_KEY']}\n"
        f"LICENSE_SIGN_PRIVATE_KEY={authority['LICENSE_SIGN_PRIVATE_KEY']}\n"
        f"LICENSE_VERIFY_PUBLIC_KEY={authority['LICENSE_VERIFY_PUBLIC_KEY']}\n"
        f"LICENSE_DECRYPT_PRIVATE_KEY={authority['LICENSE_DECRYPT_PRIVATE_KEY']}\n"
        f"LICENSE_ENCRYPT_PUBLIC_KEY={authority['LICENSE_ENCRYPT_PUBLIC_KEY']}\n"
    )


def _authority_public_env_text(authority):
    return (
        "# Product runtime license bundle.\n"
        f"LICENSE_VERIFY_PUBLIC_KEY={authority['LICENSE_VERIFY_PUBLIC_KEY']}\n"
        f"LICENSE_DECRYPT_PRIVATE_KEY={authority['LICENSE_DECRYPT_PRIVATE_KEY']}\n"
        f"LICENSE_ENCRYPT_PUBLIC_KEY={authority['LICENSE_ENCRYPT_PUBLIC_KEY']}\n"
    )


def ensure_release_authority_bundle():
    global RELEASE_AUTHORITY

    explicit_sign_key = (os.environ.get("PM_RELEASE_LICENSE_SIGN_KEY") or "").strip()
    explicit_private_key = (os.environ.get("PM_RELEASE_LICENSE_SIGN_PRIVATE_KEY") or "").strip()
    explicit_public_key = (os.environ.get("PM_RELEASE_LICENSE_VERIFY_PUBLIC_KEY") or "").strip()
    explicit_decrypt_private_key = (os.environ.get("PM_RELEASE_LICENSE_DECRYPT_PRIVATE_KEY") or "").strip()
    explicit_encrypt_public_key = (os.environ.get("PM_RELEASE_LICENSE_ENCRYPT_PUBLIC_KEY") or "").strip()

    authority = {
        "LICENSE_SIGN_KEY": "",
        "LICENSE_SIGN_PRIVATE_KEY": "",
        "LICENSE_VERIFY_PUBLIC_KEY": "",
        "LICENSE_DECRYPT_PRIVATE_KEY": "",
        "LICENSE_ENCRYPT_PUBLIC_KEY": "",
    }

    if explicit_sign_key and not _is_placeholder_license_key(explicit_sign_key):
        authority["LICENSE_SIGN_KEY"] = explicit_sign_key
    if explicit_private_key:
        authority["LICENSE_SIGN_PRIVATE_KEY"] = explicit_private_key
    if explicit_public_key:
        authority["LICENSE_VERIFY_PUBLIC_KEY"] = explicit_public_key
    if explicit_decrypt_private_key:
        authority["LICENSE_DECRYPT_PRIVATE_KEY"] = explicit_decrypt_private_key
    if explicit_encrypt_public_key:
        authority["LICENSE_ENCRYPT_PUBLIC_KEY"] = explicit_encrypt_public_key

    for candidate in (*AUTHORITY_FILE_CANDIDATES, os.path.join(PROJECT_ROOT, ".env")):
        values = _parse_simple_env(candidate)
        candidate_sign = values.get("LICENSE_SIGN_KEY", "").strip()
        if not authority["LICENSE_SIGN_KEY"] and candidate_sign and not _is_placeholder_license_key(candidate_sign):
            authority["LICENSE_SIGN_KEY"] = candidate_sign
        candidate_private = values.get("LICENSE_SIGN_PRIVATE_KEY", "").strip()
        if not authority["LICENSE_SIGN_PRIVATE_KEY"] and candidate_private:
            authority["LICENSE_SIGN_PRIVATE_KEY"] = candidate_private
        candidate_public = values.get("LICENSE_VERIFY_PUBLIC_KEY", "").strip()
        if not authority["LICENSE_VERIFY_PUBLIC_KEY"] and candidate_public:
            authority["LICENSE_VERIFY_PUBLIC_KEY"] = candidate_public
        candidate_decrypt = values.get("LICENSE_DECRYPT_PRIVATE_KEY", "").strip()
        if not authority["LICENSE_DECRYPT_PRIVATE_KEY"] and candidate_decrypt:
            authority["LICENSE_DECRYPT_PRIVATE_KEY"] = candidate_decrypt
        candidate_encrypt = values.get("LICENSE_ENCRYPT_PUBLIC_KEY", "").strip()
        if not authority["LICENSE_ENCRYPT_PUBLIC_KEY"] and candidate_encrypt:
            authority["LICENSE_ENCRYPT_PUBLIC_KEY"] = candidate_encrypt

    if not authority["LICENSE_SIGN_PRIVATE_KEY"] or not authority["LICENSE_VERIFY_PUBLIC_KEY"]:
        keypair = _generate_ed25519_keypair()
        authority["LICENSE_SIGN_PRIVATE_KEY"] = authority["LICENSE_SIGN_PRIVATE_KEY"] or keypair["LICENSE_SIGN_PRIVATE_KEY"]
        authority["LICENSE_VERIFY_PUBLIC_KEY"] = authority["LICENSE_VERIFY_PUBLIC_KEY"] or keypair["LICENSE_VERIFY_PUBLIC_KEY"]
    if not authority["LICENSE_DECRYPT_PRIVATE_KEY"] or not authority["LICENSE_ENCRYPT_PUBLIC_KEY"]:
        enc_keypair = _generate_x25519_keypair()
        authority["LICENSE_DECRYPT_PRIVATE_KEY"] = authority["LICENSE_DECRYPT_PRIVATE_KEY"] or enc_keypair["LICENSE_DECRYPT_PRIVATE_KEY"]
        authority["LICENSE_ENCRYPT_PUBLIC_KEY"] = authority["LICENSE_ENCRYPT_PUBLIC_KEY"] or enc_keypair["LICENSE_ENCRYPT_PUBLIC_KEY"]

    if not authority["LICENSE_SIGN_KEY"]:
        authority["LICENSE_SIGN_KEY"] = hashlib.sha256(os.urandom(64)).hexdigest()

    RELEASE_AUTHORITY = authority
    _write_secret_file(AUTHORITY_FILE_CANDIDATES[0], _authority_full_env_text(authority))

    private_outputs = [
        os.path.join(PRIVATE_DIST_DIR, AUTHORITY_BUNDLE_BASENAME),
        os.path.join(PRIVATE_DIST_DIR, f"patchmaster-license-authority-{VERSION}.env"),
    ]
    for out_path in private_outputs:
        _write_secret_file(out_path, _authority_full_env_text(authority))

    public_outputs = [
        os.path.join(PRIVATE_DIST_DIR, PUBLIC_AUTHORITY_BUNDLE_BASENAME),
        os.path.join(PRIVATE_DIST_DIR, f"patchmaster-license-public-{VERSION}.env"),
    ]
    for out_path in public_outputs:
        _write_secret_file(out_path, _authority_public_env_text(authority))

    log(f"Prepared operator-only authority bundle: {os.path.join(PRIVATE_DIST_DIR, AUTHORITY_BUNDLE_BASENAME)}")
    log(f"Prepared product-safe public bundle: {os.path.join(PRIVATE_DIST_DIR, PUBLIC_AUTHORITY_BUNDLE_BASENAME)}")

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

def calculate_sha256(file_path):
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def _runtime_stamp_path(venv_dir):
    return os.path.join(venv_dir, ".pm_release_runtime_stamp")


def _runtime_requirements_stamp(lockfile, offline):
    parts = [
        f"python={sys.version_info.major}.{sys.version_info.minor}",
        f"offline={int(bool(offline))}",
    ]
    files = [
        os.path.join(PROJECT_ROOT, "backend", "requirements.txt"),
        os.path.join(PROJECT_ROOT, "vendor", "requirements.txt"),
    ]
    if lockfile and os.path.isfile(lockfile):
        files.append(lockfile)
    for p in files:
        parts.append(f"{os.path.basename(p)}={calculate_sha256(p)}")
    return "\n".join(parts)


def _pip_install(py, pip_env, pip_args, requirements_file):
    cmd = [py, "-m", "pip", "install", "-v", *pip_args, "-r", requirements_file]
    log(f"Running: {' '.join(cmd)}")
    subprocess.run(cmd, check=True, env=pip_env)


def validate_offline_wheelhouse(py_tag, offline):
    if not offline:
        return
    wheel_script = os.path.join(PROJECT_ROOT, "scripts", "manage_offline_wheels.py")
    if not os.path.isfile(wheel_script):
        raise FileNotFoundError("Missing scripts/manage_offline_wheels.py")
    profiles = ["linux-py310"]
    if sys.platform.startswith("linux") and py_tag == "py312":
        profiles.append("linux-py312")
    for profile in profiles:
        subprocess.run([sys.executable, wheel_script, "check", "--profile", profile], check=True)

def make_executable(path):
    st = os.stat(path)
    os.chmod(path, st.st_mode | stat.S_IEXEC)


def copy_item(src, dst, ignore_patterns=None):
    if os.path.isdir(src):
        copy_tree(src, dst, ignore_patterns or [])
        return True
    if os.path.isfile(src):
        ensure_dir(os.path.dirname(dst))
        shutil.copy2(src, dst)
        return True
    return False


def remove_path(path):
    if os.path.isdir(path):
        shutil.rmtree(path, ignore_errors=True)
    elif os.path.exists(path):
        os.remove(path)


def reset_dir(path):
    if os.path.isdir(path):
        shutil.rmtree(path, ignore_errors=True)
    os.makedirs(path, exist_ok=True)


def cleanup_legacy_archives():
    for path in STALE_RELEASE_OUTPUTS:
        if os.path.exists(path):
            remove_path(path)


def prune_customer_product(prod_dir):
    removed = []
    for rel_path in CUSTOMER_PRODUCT_PRUNE_PATHS:
        target = os.path.join(prod_dir, *rel_path.split("/"))
        if not os.path.exists(target):
            continue
        remove_path(target)
        removed.append(rel_path)
    if removed:
        log("Pruned developer-only content from customer product package.")
    return removed


def is_heavy_profile():
    return RELEASE_PROFILE in {"heavy", "full", "fat", "offline-qa"}


def include_playwright_browsers():
    return (os.environ.get("PM_INCLUDE_PLAYWRIGHT_BROWSERS", "0") or "0").strip().lower() in {"1", "true", "yes", "on"}


def generated_pdf(name):
    return os.path.join(PDF_OUTPUT_DIR, name)


def guides_available():
    return all(os.path.isfile(generated_pdf(name)) for name in GUIDE_PDFS)


def ensure_reportlab_runtime():
    if importlib.util.find_spec("reportlab") is not None:
        return True
    pip_cmd = [sys.executable, "-m", "pip", "install", "reportlab"]
    wheels_dir = os.path.join(PROJECT_ROOT, "vendor", "wheels")
    if os.path.isdir(wheels_dir):
        pip_cmd.extend(["--find-links", wheels_dir])
    if (os.environ.get("OFFLINE", "0") or "0").strip() == "1":
        pip_cmd.insert(4, "--no-index")
    try:
        subprocess.run(pip_cmd, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError:
        return False
    return importlib.util.find_spec("reportlab") is not None


def build_release_guides():
    guide_script = os.path.join(PROJECT_ROOT, "scripts", "generate_pdf_guides.py")
    if not os.path.isfile(guide_script):
        if FAIL_ON_MISSING:
            raise FileNotFoundError("PDF guide generator not found.")
        warn("PDF guide generator not found; skipping guide generation.")
        return
    if importlib.util.find_spec("reportlab") is None:
        if ensure_reportlab_runtime():
            log("Installed reportlab in release runtime for PDF guide generation.")
        elif guides_available():
            log(
                "reportlab is not available in release runtime; "
                f"reusing existing guides from {PDF_OUTPUT_DIR}."
            )
            return
        else:
            raise RuntimeError(
                "reportlab is required to generate PDF guides and no existing guides were found."
            )
    log("Generating role-based PDF guides...")
    result = subprocess.run([sys.executable, guide_script], capture_output=True, text=True)
    if result.returncode == 0:
        if result.stdout:
            print(result.stdout, end="")
        if result.stderr:
            print(result.stderr, end="", file=sys.stderr)
        return

    if guides_available():
        reason = ""
        stderr_lines = [line.strip() for line in result.stderr.splitlines() if line.strip()]
        if stderr_lines:
            reason = f" ({stderr_lines[-1]})"
        log(
            f"PDF guide regeneration failed with {sys.executable}; "
            f"reusing existing guides from {PDF_OUTPUT_DIR}{reason}."
        )
        return

    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)
    raise subprocess.CalledProcessError(result.returncode, result.args)


def _venv_python(venv_dir):
    if os.name == "nt":
        return os.path.join(venv_dir, "Scripts", "python.exe")
    return os.path.join(venv_dir, "bin", "python")


def _missing_modules():
    return [name for name in REQUIRED_MODULES if importlib.util.find_spec(name) is None]


def ensure_release_runtime():
    missing = _missing_modules()
    if not missing:
        return
    if os.environ.get(BOOTSTRAP_MARKER) == "1":
        raise RuntimeError(f"Release runtime is still missing required modules: {', '.join(missing)}")

    preferred_venv = os.environ.get("PM_RELEASE_VENV") or DEFAULT_RELEASE_VENV
    preferred_py = _venv_python(preferred_venv)
    current_py = os.path.abspath(sys.executable)
    if os.path.isfile(preferred_py) and os.path.abspath(preferred_py) != current_py:
        rerun_env = os.environ.copy()
        rerun_env["PM_RELEASE_VENV"] = preferred_venv
        raise SystemExit(subprocess.call([preferred_py, os.path.abspath(__file__)], env=rerun_env))

    log(f"Bootstrapping release runtime for missing modules: {', '.join(missing)}")
    venv_dir = preferred_venv
    py = _venv_python(venv_dir)
    if not os.path.isdir(venv_dir) or not os.path.isfile(py):
        log(f"Creating release runtime venv at: {venv_dir}")
        venv.EnvBuilder(with_pip=True).create(venv_dir)
        py = _venv_python(venv_dir)

    pip_env = os.environ.copy()
    pip_env.setdefault("PIP_DISABLE_PIP_VERSION_CHECK", "1")
    wheels_dir = os.path.join(PROJECT_ROOT, "vendor", "wheels")
    py_tag = f"py{sys.version_info.major}{sys.version_info.minor}"
    if os.name == "nt":
        platform_tag = "windows"
    elif sys.platform.startswith("linux"):
        platform_tag = "linux"
    elif sys.platform == "darwin":
        platform_tag = "macos"
    else:
        platform_tag = sys.platform
    lockfile = os.path.join(PROJECT_ROOT, "vendor", f"requirements-{platform_tag}-{py_tag}.lock.txt")
    if not os.path.isfile(lockfile) and platform_tag == "linux" and py_tag == "py312":
        lockfile = os.path.join(PROJECT_ROOT, "vendor", "requirements-linux-py312.lock.txt")

    offline_default = "0" if os.name == "nt" else "1"
    offline = (os.environ.get("OFFLINE", offline_default) or offline_default).strip() == "1"

    # Support Python 3.10+ for flexibility across different environments
    if sys.version_info < (3, 10):
        raise RuntimeError(
            "PatchMaster build requires Python 3.10 or newer. "
            f"Current version: {sys.version_info.major}.{sys.version_info.minor}"
        )

    pip_args = []
    if offline:
        if not os.path.isdir(wheels_dir):
            raise RuntimeError("OFFLINE=1 but vendor/wheels is missing.")
        pip_args.extend(["--no-index", "--find-links", wheels_dir])
    else:
        if os.path.isdir(wheels_dir):
            pip_args.extend(["--find-links", wheels_dir])
    if os.path.isfile(lockfile):
        pip_args.extend(["-c", lockfile])

    validate_offline_wheelhouse(py_tag, offline)

    if not offline:
        log("Installing/Upgrading pip in release runtime...")
        subprocess.run([py, "-m", "pip", "install", "--upgrade", "pip"], check=True, env=pip_env)
    req_stamp = _runtime_requirements_stamp(lockfile, offline)
    stamp_file = _runtime_stamp_path(venv_dir)
    prev_stamp = ""
    if os.path.isfile(stamp_file):
        try:
            with open(stamp_file, "r", encoding="utf-8") as fh:
                prev_stamp = fh.read()
        except Exception:
            prev_stamp = ""
    if req_stamp == prev_stamp and not missing:
        log("Release runtime dependencies unchanged; skipping pip install step.")
    else:
        if req_stamp == prev_stamp and missing:
            log(
                "Release runtime stamp is unchanged, but required modules are still missing; "
                "reinstalling runtime dependencies."
            )
        log("Installing backend Python requirements into release runtime...")
        _pip_install(py, pip_env, pip_args, os.path.join(PROJECT_ROOT, "backend", "requirements.txt"))
        log("Installing vendor Python requirements into release runtime...")
        _pip_install(py, pip_env, pip_args, os.path.join(PROJECT_ROOT, "vendor", "requirements.txt"))
        with open(stamp_file, "w", encoding="utf-8") as fh:
            fh.write(req_stamp)

    rerun_env = os.environ.copy()
    rerun_env[BOOTSTRAP_MARKER] = "1"
    rerun_env["PM_RELEASE_VENV"] = venv_dir
    rerun_env.setdefault("VENV_DIR", venv_dir)
    raise SystemExit(subprocess.call([py, os.path.abspath(__file__)], env=rerun_env))

def copy_tree(src, dst, ignore_patterns=None):
    if ignore_patterns is None:
        ignore_patterns = []
    ensure_dir(dst)
    copied_files = 0
    copied_bytes = 0
    started = time.time()
    for root, dirs, files in os.walk(src):
        rel_root = os.path.relpath(root, src)
        rel_root = "" if rel_root == "." else rel_root
        dirs[:] = [d for d in dirs if not any(fnmatch.fnmatch(d, p) for p in ignore_patterns)]
        kept_files = [f for f in files if not any(fnmatch.fnmatch(f, p) for p in ignore_patterns)]
        dst_root = os.path.join(dst, rel_root) if rel_root else dst
        ensure_dir(dst_root)
        for name in kept_files:
            src_file = os.path.join(root, name)
            dst_file = os.path.join(dst_root, name)
            shutil.copy2(src_file, dst_file)
            copied_files += 1
            try:
                copied_bytes += os.path.getsize(src_file)
            except OSError:
                pass
            if copied_files % 200 == 0:
                mb = copied_bytes / (1024 * 1024)
                elapsed = max(time.time() - started, 0.001)
                speed = mb / elapsed
                log(f"  copied {copied_files} files ({mb:.1f} MB, {speed:.1f} MB/s) ... latest: {os.path.relpath(src_file, src)}")
    mb = copied_bytes / (1024 * 1024)
    elapsed = max(time.time() - started, 0.001)
    speed = mb / elapsed
    log(f"  finished copy: {copied_files} files, {mb:.1f} MB at {speed:.1f} MB/s")


def _candidate_playwright_paths():
    paths = []
    env_path = (os.environ.get("PLAYWRIGHT_BROWSERS_PATH") or "").strip()
    if env_path and env_path != "0":
        paths.append(env_path)
    if os.name == "nt":
        local_app = os.environ.get("LOCALAPPDATA")
        if local_app:
            paths.append(os.path.join(local_app, "ms-playwright"))
    else:
        home = os.path.expanduser("~")
        paths.append(os.path.join(home, ".cache", "ms-playwright"))
    paths.append(os.path.join(PROJECT_ROOT, "frontend", ".playwright"))
    seen = set()
    result = []
    for p in paths:
        if not p:
            continue
        norm = os.path.normpath(p)
        if norm in seen:
            continue
        seen.add(norm)
        result.append(norm)
    return result


def _copy_playwright_browsers(prod_dir):
    for candidate in _candidate_playwright_paths():
        if not os.path.isdir(candidate):
            continue
        dst = os.path.join(prod_dir, "frontend", "ms-playwright")
        log(f"Bundling Playwright browser cache from {candidate}")
        copy_tree(candidate, dst, ["__pycache__", "*.tmp"])
        return True
    warn("Heavy profile requested but no Playwright browser cache directory was found.")
    return False


def build_product(staging_root):
    log("Building Product package...")
    log(f"Release profile: {RELEASE_PROFILE}")
    prod_dir = os.path.join(staging_root, f"patchmaster-product-{VERSION}")
    ensure_dir(prod_dir)

    # 0. Pre-build Agent Artifacts
    log("Invoking Agent Builder...")
    agent_builder = os.path.join(PROJECT_ROOT, "agent", "build_agent_artifacts.py")
    builder_env = os.environ.copy()
    # Default to offline-safe builds; set OFFLINE=0 only if you want to allow online fetch or rely on external repos.
    builder_env.setdefault("OFFLINE", "1")
    builder_env.setdefault("PIP_OPTS", builder_env.get("PIP_OPTS", "--no-index"))
    builder_env.setdefault("PIP_DISABLE_PIP_VERSION_CHECK", "1")
    if not builder_env.get("VENV_DIR"):
        builder_env["VENV_DIR"] = builder_env.get("PM_RELEASE_VENV", os.path.join(PROJECT_ROOT, ".build-venv"))
    default_wheels = os.path.join(PROJECT_ROOT, "vendor", "wheels")
    if not builder_env.get("PIP_FIND_LINKS") and os.path.isdir(default_wheels):
        builder_env["PIP_FIND_LINKS"] = default_wheels
    subprocess.run([sys.executable, agent_builder], check=True, env=builder_env)
    log("Agent Builder finished. Continuing product packaging...")

    # Check binaries — all four artifacts are required for a complete release
    binaries = [
        "agent-latest.deb",
        "agent-latest.rpm",
        "agent-windows.zip",
        "patchmaster-agent-installer.exe",
    ]
    missing_binaries = [b for b in binaries if not os.path.exists(os.path.join(PROJECT_ROOT, "backend", "static", b))]
    if missing_binaries:
        msg = f"Missing binaries: {', '.join(f'backend/static/{b}' for b in missing_binaries)}"
        if FAIL_ON_MISSING:
            raise FileNotFoundError(msg)
        warn(msg)

    # Copy components
    components = ["agent", "backend", "frontend", "monitoring", "packaging", "scripts"]
    # Add agent build scratch dirs to avoid copying huge Windows venvs/stages into the product tarball.
    ignores = [
        "__pycache__", "*.pyc", "node_modules", ".env", "*.db", ".git", ".idea", ".vscode",
        "winbuild_venv", "pyi_build", "windows_stage", "iexpress_stage",
        ".venv-check", ".venv", "venv", ".pytest_cache", "reports", "test-results",
        ".build-release-venv", ".venv-vendor"
    ]
    if is_heavy_profile():
        ignores = [p for p in ignores if p != "node_modules"]
    
    for comp in components:
        src = os.path.join(PROJECT_ROOT, comp)
        if os.path.isdir(src):
            dst = os.path.join(prod_dir, comp)
            log(f"Copying component: {comp}")
            copy_tree(src, dst, ignores)
    scripts_dst = os.path.join(prod_dir, "scripts")
    if os.path.isdir(scripts_dst):
        for fname in os.listdir(scripts_dst):
            fpath = os.path.join(scripts_dst, fname)
            if os.path.isdir(fpath):
                shutil.rmtree(fpath, ignore_errors=True)
                continue
            if fname not in CUSTOMER_SCRIPT_ALLOWLIST:
                os.remove(fpath)
        log(
            "Pruned scripts bundle to customer-required files: "
            + ", ".join(sorted(CUSTOMER_SCRIPT_ALLOWLIST))
        )
    if is_heavy_profile():
        if include_playwright_browsers():
            _copy_playwright_browsers(prod_dir)
        else:
            log("Skipping Playwright browser cache bundle (set PM_INCLUDE_PLAYWRIGHT_BROWSERS=1 to include).")
    testdeps_src = os.path.join(PROJECT_ROOT, "vendor", "python-testdeps-flat")
    testdeps_dst = os.path.join(prod_dir, "vendor", "python-testdeps-flat")
    wheels_src_dir = os.path.join(PROJECT_ROOT, "vendor", "wheels")
    wheels_dst_dir = os.path.join(prod_dir, "vendor", "wheels")
    if os.path.isdir(wheels_src_dir):
        log("Bundling vendor wheelhouse for backend/agent installs...")
        copy_tree(wheels_src_dir, wheels_dst_dir, ["__pycache__", "*.pyc"])
    else:
        warn("vendor/wheels is missing; product installs may need internet access.")
    if os.path.isfile(os.path.join(testdeps_src, "pytest", "__init__.py")):
        log("Bundling extracted backend test dependencies...")
        copy_tree(testdeps_src, testdeps_dst, ["__pycache__", "*.pyc"])
    else:
        missing_test_wheels = []
        for wheel in TEST_WHEELS:
            src_wheel = os.path.join(wheels_src_dir, wheel)
            if os.path.isfile(src_wheel):
                shutil.copy2(src_wheel, os.path.join(wheels_dst_dir, wheel))
            else:
                missing_test_wheels.append(wheel)
        if missing_test_wheels:
            warn(
                "Missing bundled backend test wheels for testing UI readiness: "
                + ", ".join(missing_test_wheels)
            )
        else:
            log("Bundled backend test wheels for testing UI readiness.")

    # Copy root configs
    root_files = [
        "docker-compose.yml", "docker-compose.prod.yml", "docker-compose.ha.yml",
        ".env.production", "Makefile", "LICENSE"
    ]
    for f in root_files:
        src = os.path.join(PROJECT_ROOT, f)
        if os.path.exists(src):
            shutil.copy2(src, prod_dir)
    log("Copied root configuration files.")

    # Copy End-User Docs
    docs_src = os.path.join(PROJECT_ROOT, "docs", "public")
    docs_dst = os.path.join(prod_dir, "docs")
    ensure_dir(docs_dst)
    if os.path.isdir(docs_src):
        for f in os.listdir(docs_src):
            shutil.copy2(os.path.join(docs_src, f), docs_dst)
    customer_pdf = generated_pdf(f"PatchMaster_Customer_User_Guide_v{VERSION}.pdf")
    if os.path.isfile(customer_pdf):
        shutil.copy2(customer_pdf, docs_dst)
    else:
        if FAIL_ON_MISSING:
            raise FileNotFoundError("Missing generated customer PDF guide for product package.")
        warn("Missing generated customer PDF guide for product package.")
    log("Prepared product docs bundle.")

    public_authority_path = os.path.join(prod_dir, PUBLIC_AUTHORITY_BUNDLE_BASENAME)
    _write_secret_file(public_authority_path, _authority_public_env_text(RELEASE_AUTHORITY))
    log("Bundled public license verification material for product installs.")

    removed = prune_customer_product(prod_dir)
    if removed:
        log("Customer package excludes developer-only files; see dist/developer for the unpacked supplement files.")
    if not os.path.isfile(os.path.join(prod_dir, "frontend", "dist", "index.html")):
        raise FileNotFoundError("Customer product package requires frontend/dist/index.html, but the prebuilt frontend bundle is missing.")

    # Make scripts executable
    for root, dirs, files in os.walk(prod_dir):
        for file in files:
            if file.endswith(".sh"):
                make_executable(os.path.join(root, file))

    # Create README
    with open(os.path.join(prod_dir, "README.md"), "w") as f:
        f.write(f"""# PatchMaster v{VERSION} — Enterprise Patch Management

## Installation Guide

### Option 1: Docker Deployment (Recommended)
1. Use the helper:
   ```bash
   bash scripts/install_patchmaster_docker.sh
   ```
   It creates or updates `.env`, generates missing secrets, and starts the stack.
2. Manual alternative:
   ```bash
   cp .env.production .env
   nano .env  # Replace placeholder secrets before running docker compose
   docker-compose -f docker-compose.prod.yml up -d
   ```

### Option 2: Bare Metal (Linux)
1. Run the installer:
   ```bash
   sudo ./packaging/install-bare.sh --with-monitoring
   ```
   Pass `--env /path/to/real.env` only if you created a custom env file.
2. Public-key license verification is bundled automatically for this release.
   No shared signing secret should be copied into customer environments.

## Access
- Dashboard: http://YOUR-SERVER-IP
- API Docs:  http://YOUR-SERVER-IP/api/docs

## Developer Assets
- This customer package intentionally excludes build/test source that is not required for standard deployment.
- Use the separate `dist/developer/patchmaster-developer-kit-{VERSION}/` folder for rebuild, test, and customization workflows.
""")
    log("Generated product README.")

    # Create tarball
    tar_name = f"patchmaster-product-{VERSION}.tar.gz"
    tar_path = os.path.join(DIST_DIR, tar_name)
    log(f"Creating product tarball: {tar_name}")
    compresslevel = 1 if is_heavy_profile() else 9
    with tarfile.open(tar_path, "w:gz", compresslevel=compresslevel) as tar:
        tar.add(prod_dir, arcname=os.path.basename(prod_dir))
    
    sha = calculate_sha256(tar_path)
    size_mb = os.path.getsize(tar_path) / (1024 * 1024)
    with open(os.path.join(DIST_DIR, f"{tar_name}.sha256"), "w") as f:
        f.write(f"{sha}  {tar_name}")
    
    log(f"Product package created: {tar_name} ({size_mb:.1f} MB)")
    log(f"SHA256: {sha}")
    return tar_path


def export_developer_folder(staging_root):
    log("Preparing Developer supplement folder...")
    dev_dir = os.path.join(DEVELOPER_DIST_DIR, f"patchmaster-developer-kit-{VERSION}")
    reset_dir(dev_dir)

    for rel_path in DEVELOPER_BUNDLE_ITEMS:
        src = os.path.join(PROJECT_ROOT, *rel_path.split("/"))
        dst = os.path.join(dev_dir, *rel_path.split("/"))
        if copy_item(src, dst, DEVELOPER_IGNORE_PATTERNS):
            log(f"Included developer asset: {rel_path}")

    guides_dst = os.path.join(dev_dir, "docs", "internal")
    ensure_dir(guides_dst)
    for guide_name in DEVELOPER_GUIDES:
        guide_path = generated_pdf(guide_name)
        if os.path.isfile(guide_path):
            shutil.copy2(guide_path, guides_dst)

    with open(os.path.join(dev_dir, "README.md"), "w", encoding="utf-8") as fh:
        fh.write(
            f"""# PatchMaster Developer Kit v{VERSION}

This bundle contains source, build, and test assets that are intentionally
excluded from the customer-facing product tarball.

Included:
- backend tests and developer Dockerfile
- frontend source assets and developer Dockerfile
- agent build scripts/specs and Windows installer source helpers
- internal developer/support documents
- full developer script set

Use this bundle together with the product package when you need to rebuild,
test, or customize PatchMaster beyond standard customer installation.
"""
        )
    log(f"Developer folder prepared: {dev_dir}")
    return dev_dir

def build_vendor(staging_root):
    log("Building Vendor package...")
    vend_dir = os.path.join(staging_root, f"patchmaster-vendor-{VERSION}")
    ensure_dir(vend_dir)

    src = os.path.join(PROJECT_ROOT, "vendor")
    # Exclude caches/temp/wheels to keep vendor package clean and avoid permission issues
    ignores = [
        "__pycache__", "*.pyc", "*.db", "data", "backups", ".env", "dist",
        "wheels", "tmp", "python-testdeps", "python-testdeps-flat",
    ]
    ignored_vendor_items = {"dist", "__pycache__", "data", "backups", ".env", "python-testdeps", "python-testdeps-flat"}
    
    # We copy content of vendor to vend_dir
    # But copy_tree copies the folder itself if we point to it, or contents?
    # shutil.copytree requires dst to not exist usually.
    # We want to copy contents of vendor/ into vend_dir/
    # Let's iterate over items in vendor/
    if os.path.isdir(src):
        for item in os.listdir(src):
            if item in ignored_vendor_items:
                continue
            s = os.path.join(src, item)
            d = os.path.join(vend_dir, item)
            if os.path.isdir(s):
                log(f"Copying vendor directory: {item}")
                copy_tree(s, d, ignores)
            else:
                log(f"Copying vendor file: {item}")
                shutil.copy2(s, d)

    vendor_docs_dir = os.path.join(vend_dir, "docs")
    ensure_dir(vendor_docs_dir)
    for guide_name in (
        f"PatchMaster_Developer_Guide_v{VERSION}.pdf",
        f"PatchMaster_Support_Runbook_v{VERSION}.pdf",
    ):
        guide_path = generated_pdf(guide_name)
        if os.path.isfile(guide_path):
            shutil.copy2(guide_path, vendor_docs_dir)
        else:
            if FAIL_ON_MISSING:
                raise FileNotFoundError(f"Missing generated vendor PDF guide: {guide_name}")
            warn(f"Missing generated vendor PDF guide: {guide_name}")

    _write_secret_file(
        os.path.join(vend_dir, AUTHORITY_BUNDLE_BASENAME),
        _authority_full_env_text(RELEASE_AUTHORITY),
    )
    log("Bundled vendor authority material for vendor-side installs.")

    # Create README
    with open(os.path.join(vend_dir, "README.md"), "w") as f:
        f.write("""# PatchMaster Vendor Portal

Internal tool for generating licenses and managing customers.
This package is intended for operator/vendor-side deployment only.

## Quick Start
1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Run Portal:
   ```bash
   python app.py
   ```
3. Generate License CLI:
   ```bash
   python generate-license.py --help
   ```
""")
    log("Generated vendor README.")

    # Create tarball
    tar_name = f"patchmaster-vendor-{VERSION}.tar.gz"
    tar_path = os.path.join(VENDOR_DIST_DIR, tar_name)
    log(f"Creating vendor tarball: {tar_name}")
    with tarfile.open(tar_path, "w:gz") as tar:
        tar.add(vend_dir, arcname=os.path.basename(vend_dir))
    
    sha = calculate_sha256(tar_path)
    with open(os.path.join(VENDOR_DIST_DIR, f"{tar_name}.sha256"), "w") as f:
        f.write(f"{sha}  {tar_name}")
    
    log(f"Vendor package created: {tar_name}")
    return tar_path

def main():
    print(f"\n  PatchMaster v{VERSION} — Release Builder (Python)\n")
    if os.environ.get("PM_RELEASE_VENV"):
        log(f"Using release runtime: {os.environ['PM_RELEASE_VENV']}")
    ensure_release_runtime()
    
    ensure_dir(DIST_DIR)
    ensure_dir(VENDOR_DIST_DIR)
    ensure_dir(DEVELOPER_DIST_DIR)
    ensure_dir(PRIVATE_DIST_DIR)
    cleanup_legacy_archives()
    ensure_release_authority_bundle()
    
    # Pre-run tests
    log("Running test suites...")
    test_script = os.path.join(PROJECT_ROOT, "scripts", "run_tests.py")
    subprocess.run([sys.executable, test_script], check=True)
    build_release_guides()
    
    with tempfile.TemporaryDirectory() as staging_root:
        build_product(staging_root)
        build_vendor(staging_root)
        export_developer_folder(staging_root)
    
    print("\nRelease build complete.")

if __name__ == "__main__":
    main()
