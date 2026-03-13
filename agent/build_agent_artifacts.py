#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys


# Offline/env controls (offline by default; uses local wheels if present)
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
DEFAULT_WHEEL_DIR = os.path.join(PROJECT_ROOT, "vendor", "wheels")
PIP_CACHE_WHEELS = os.path.expanduser(os.path.join("~", ".cache", "pip", "wheels"))
OFFLINE = os.environ.get("OFFLINE", "1") not in ("0", "false", "False", "")
SKIP_LINUX = sys.platform.startswith("win") or (os.environ.get("SKIP_LINUX", "") not in ("", "0", "false", "False"))
PIP_FIND_LINKS = os.environ.get("PIP_FIND_LINKS") or (DEFAULT_WHEEL_DIR if os.path.isdir(DEFAULT_WHEEL_DIR) else None)
if not PIP_FIND_LINKS and os.path.isdir(PIP_CACHE_WHEELS):
    PIP_FIND_LINKS = PIP_CACHE_WHEELS
PIP_OPTS = os.environ.get("PIP_OPTS", "--no-index")
PIP_ENV = os.environ.copy()
PIP_ENV["PIP_DISABLE_PIP_VERSION_CHECK"] = "1"
if PIP_FIND_LINKS:
    PIP_ENV["PIP_FIND_LINKS"] = PIP_FIND_LINKS

# Helper to build pip argument list while honoring env
def pip_args(extra=None):
    args = []
    if PIP_OPTS:
        args.extend(PIP_OPTS.split())
    if PIP_FIND_LINKS:
        args.extend(["--find-links", PIP_FIND_LINKS])
    if extra:
        args.extend(extra)
    return args

# Paths
AGENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_STATIC_DIR = os.path.join(AGENT_DIR, "..", "backend", "static")
DIST_DIR = os.path.join(AGENT_DIR, "dist")

def log(msg):
    print(f"[AgentBuilder] {msg}")

def build_windows_zip():
    log("Building Windows Agent (ZIP)...")
    # Simulate creating a Windows package
    # In a real scenario, this might involve PyInstaller or bundling a venv
    
    zip_name = "agent-windows"
    zip_path = os.path.join(DIST_DIR, zip_name)
    
    # Create a staging directory
    stage_dir = os.path.join(DIST_DIR, "windows_stage")
    if os.path.exists(stage_dir): shutil.rmtree(stage_dir)
    os.makedirs(stage_dir)
    
    # Copy files
    shutil.copy(os.path.join(AGENT_DIR, "agent.py"), stage_dir)
    shutil.copy(os.path.join(AGENT_DIR, "main.py"), stage_dir)
    shutil.copy(os.path.join(AGENT_DIR, "requirements.txt"), stage_dir)
    
    # Add a README for Windows users
    with open(os.path.join(stage_dir, "README.txt"), "w") as f:
        f.write("PatchMaster Windows Agent\n")
        f.write("1. Install Python 3.8+\n")
        f.write("2. pip install -r requirements.txt\n")
        f.write("3. python agent.py --port 8080 --metrics-port 9100\n")
        f.write("4. CONTROLLER_URL=http://<master>:8000 python main.py\n")

    # Zip it up
    shutil.make_archive(zip_path, 'zip', stage_dir)
    final_path = zip_path + ".zip"
    
    log(f"Created: {final_path}")
    return final_path


def build_windows_installer_exe():
    if not sys.platform.startswith("win"):
        return None

    venv_dir = os.path.join(DIST_DIR, "winbuild_venv")
    py = os.path.join(venv_dir, "Scripts", "python.exe")
    pip = os.path.join(venv_dir, "Scripts", "pip.exe")
    if not os.path.exists(py):
        subprocess.run([sys.executable, "-m", "venv", venv_dir], check=True)
    install_cmd = [pip, "install"] + pip_args(["-r", os.path.join(AGENT_DIR, "requirements.txt")])
    subprocess.run(install_cmd, check=True, env=PIP_ENV)
    subprocess.run([pip, "install"] + pip_args(["pyinstaller"]), check=True, env=PIP_ENV)

    build_dir = os.path.join(DIST_DIR, "pyi_build")
    dist_dir = os.path.join(DIST_DIR, "pyi_dist")
    for d in [build_dir, dist_dir]:
        if os.path.exists(d):
            shutil.rmtree(d, ignore_errors=True)

    agent_py = os.path.join(AGENT_DIR, "agent.py")
    hb_py = os.path.join(AGENT_DIR, "main.py")
    installer_py = os.path.join(AGENT_DIR, "windows_installer.py")
    winsw_exe = os.path.join(AGENT_DIR, "windows_service", "winsw.exe")

    subprocess.run([py, "-m", "PyInstaller", "--noconfirm", "--clean", "--onefile", "--noconsole",
                    "--distpath", dist_dir, "--workpath", build_dir,
                    "--name", "patch-agent", agent_py], check=True)
    subprocess.run([py, "-m", "PyInstaller", "--noconfirm", "--clean", "--onefile", "--noconsole",
                    "--distpath", dist_dir, "--workpath", build_dir,
                    "--name", "patch-agent-heartbeat", hb_py], check=True)

    agent_exe = os.path.join(dist_dir, "patch-agent.exe")
    hb_exe = os.path.join(dist_dir, "patch-agent-heartbeat.exe")
    installer_name = "patchmaster-agent-installer"
    subprocess.run([py, "-m", "PyInstaller", "--noconfirm", "--clean", "--onefile",
                    "--distpath", dist_dir, "--workpath", build_dir,
                    "--name", installer_name,
                    "--add-binary", f"{agent_exe};.",
                    "--add-binary", f"{hb_exe};.",
                    "--add-binary", f"{winsw_exe};.",
                    installer_py], check=True)

    final_installer = os.path.join(dist_dir, f"{installer_name}.exe")
    if not os.path.exists(final_installer):
        raise Exception("Windows installer EXE not produced")
    log(f"Created: {final_installer}")
    return final_installer

def build_linux_rpm():
    log("Building Linux Agent (RPM)...")
    if SKIP_LINUX:
        log("SKIP_LINUX=1 -> skipping Linux packages for this run.")
        rpm_path = os.path.join(BACKEND_STATIC_DIR, "agent-latest.rpm")
        deb_path = os.path.join(BACKEND_STATIC_DIR, "agent-latest.deb")
        os.makedirs(os.path.dirname(rpm_path), exist_ok=True)
        os.makedirs(os.path.dirname(deb_path), exist_ok=True)
        if not os.path.exists(rpm_path):
            with open(rpm_path, "wb") as f:
                f.write(b"Mock RPM Content (SKIP_LINUX)")
        if not os.path.exists(deb_path):
            with open(deb_path, "wb") as f:
                f.write(b"Mock DEB Content (SKIP_LINUX)")
        return rpm_path, deb_path
    try:
        import shutil as _sh
        fpm = _sh.which("fpm")
        docker = _sh.which("docker")
        if fpm:
            script_path = os.path.join(AGENT_DIR, "..", "packaging", "fpm", "build-rpm.sh")
            version = "2.0.0"
            env = PIP_ENV.copy(); env["OFFLINE"] = "1" if OFFLINE else "0"
            subprocess.run(["bash", script_path, version], check=True, cwd=os.path.dirname(script_path), env=env)
            rpm_path = os.path.join(os.path.dirname(BACKEND_STATIC_DIR), "static", "agent-latest.rpm")
            deb_path = build_linux_deb()
            log(f"Created (FPM): {rpm_path}")
            log(f"Created (DEB): {deb_path}")
            return rpm_path, deb_path
        elif docker:
            log("FPM not found locally, attempting Docker-based build...")
            # Use Ruby image to install fpm and run our build script
            script_dir = os.path.join(AGENT_DIR, "..", "packaging", "fpm")
            project_root = os.path.abspath(os.path.join(AGENT_DIR, ".."))
            # Windows Docker Desktop supports -v "C:\path:/containerpath"
            cmd = [
                "docker", "run", "--rm",
                "-v", f"{project_root}:/workspace",
                "-w", "/workspace/packaging/fpm",
                "rockylinux:9",
                "bash", "-lc", "dnf -y install ruby rubygems rpm-build gcc make python3 python3-pip && gem install fpm && bash build-rpm.sh 2.0.0"
            ]
            env = PIP_ENV.copy(); env["OFFLINE"] = "1" if OFFLINE else "0"
            subprocess.run(cmd, check=True, env=env)
            rpm_path = os.path.join(os.path.dirname(BACKEND_STATIC_DIR), "static", "agent-latest.rpm")
            deb_path = build_linux_deb()
            log(f"Created (Docker+FPM): {rpm_path}")
            log(f"Created (DEB): {deb_path}")
            return rpm_path, deb_path
        else:
            log("Build tools (FPM, Docker) not found. Building Linux packages requires either 'fpm' gem or 'docker'.")
            raise Exception("No Linux build tools available")
    except Exception as e:
        if OFFLINE:
            raise
        log(f"Linux RPM build skipped or failed: {e}")
        log("Creating fallback artifacts for development/testing purposes.")
        rpm_path = os.path.join(DIST_DIR, "agent-latest.rpm")
        with open(rpm_path, "wb") as f:
            f.write(b"Mock RPM Content")
        deb_path = build_linux_deb()
        log(f"Created (Mock): {rpm_path}")
        log(f"Created (DEB): {deb_path}")
        return rpm_path, deb_path


def build_linux_deb():
    deb_path = os.path.join(DIST_DIR, "agent-latest.deb")
    try:
        dpkg = shutil.which("dpkg-deb")
        bash = shutil.which("bash")
        if not dpkg or not bash:
            raise Exception("dpkg-deb/bash not available")
        script_path = os.path.join(AGENT_DIR, "build-deb.sh")
        env = PIP_ENV.copy(); env["OFFLINE"] = "1" if OFFLINE else "0"
        subprocess.run([bash, script_path, deb_path], check=True, cwd=os.path.dirname(script_path), env=env)
        return deb_path
    except Exception as e:
        if OFFLINE:
            raise
        with open(deb_path, "wb") as f:
            f.write(b"Mock DEB Content")
        log(f"DEB build skipped or failed: {e}")
        return deb_path

def main():
    if not os.path.exists(DIST_DIR):
        os.makedirs(DIST_DIR)
        
    if not os.path.exists(BACKEND_STATIC_DIR):
        os.makedirs(BACKEND_STATIC_DIR)

    # 1. Build Windows
    win_pkg = build_windows_zip()
    shutil.copy(win_pkg, os.path.join(BACKEND_STATIC_DIR, "agent-windows.zip"))
    try:
        win_installer = build_windows_installer_exe()
        if win_installer:
            shutil.copy(win_installer, os.path.join(BACKEND_STATIC_DIR, "patchmaster-agent-installer.exe"))
    except Exception as e:
        log(f"Windows installer EXE build skipped or failed: {e}")
    
    # 2. Build Linux (RPM/DEB)
    rpm_pkg, deb_pkg = build_linux_rpm()
    if not SKIP_LINUX:
        rpm_dest = os.path.join(BACKEND_STATIC_DIR, "agent-latest.rpm")
        if os.path.abspath(rpm_pkg) != os.path.abspath(rpm_dest):
            shutil.copy(rpm_pkg, rpm_dest)
        deb_dest = os.path.join(BACKEND_STATIC_DIR, "agent-latest.deb")
        if os.path.abspath(deb_pkg) != os.path.abspath(deb_dest):
            shutil.copy(deb_pkg, deb_dest)
    log("Agent artifacts moved to backend/static/")

if __name__ == "__main__":
    main()
