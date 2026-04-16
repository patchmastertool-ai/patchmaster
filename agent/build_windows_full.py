#!/usr/bin/env python3
"""Build complete Windows agent package with all features."""

import os
import shutil
import zipfile

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(PROJECT_ROOT, "backend", "static")
DIST_DIR = os.path.join(PROJECT_ROOT, "agent", "dist")
PKG_BUILD = os.path.join(PROJECT_ROOT, ".pkg-build.otfVRA", "backend", "static")


def build_windows_full():
    """Build complete Windows package."""

    STAGE_DIR = os.path.join(DIST_DIR, "windows_full")
    if os.path.exists(STAGE_DIR):
        shutil.rmtree(STAGE_DIR)
    os.makedirs(STAGE_DIR)

    print("=== Building Full Windows Agent Package ===")

    # Copy installer EXEs from .pkg-build.otfVRA
    src_installer = os.path.join(PKG_BUILD, "patchmaster-agent-installer.exe")
    src_uninstaller = os.path.join(PKG_BUILD, "patchmaster-agent-uninstaller.exe")

    if os.path.exists(src_installer):
        shutil.copy(src_installer, STAGE_DIR)
        print(f"  + {os.path.basename(src_installer)}")

    if os.path.exists(src_uninstaller):
        shutil.copy(src_uninstaller, STAGE_DIR)
        print(f"  + {os.path.basename(src_uninstaller)}")

    # Copy agent source files
    AGENT_DIR = os.path.join(PROJECT_ROOT, "agent")
    for f in [
        "agent.py",
        "main.py",
        "requirements.txt",
        "solaris_manager.py",
        "hpux_manager.py",
        "aix_manager.py",
    ]:
        src = os.path.join(AGENT_DIR, f)
        if os.path.exists(src):
            shutil.copy(src, STAGE_DIR)
            print(f"  + {f}")

    # Get Python dependencies
    print("  + Downloading Python dependencies...")
    os.chdir(STAGE_DIR)
    os.system(
        "pip download -r requirements.txt -d python_deps/ --platform win_amd64 2>nul || "
        "pip download -r requirements.txt -d python_deps/ 2>nul || echo 'Using cached'"
    )

    # Create startup script
    with open(os.path.join(STAGE_DIR, "start-agent.bat"), "w") as f:
        f.write("""@echo off
REM PatchMaster Agent - Windows
REM Supports online and offline (air-gapped) modes

set CONTROLLER_URL=http://localhost:8000
set PORT=8080
set OFFLINE=false

if "%OFFLINE%"=="true" (
    echo [OFFLINE MODE] Installing from bundled dependencies...
    pip install --no-index --find-links=python_deps/ -r requirements.txt
) else (
    pip install -r requirements.txt
)

echo Starting PatchMaster Agent...
python agent.py --port %PORT% --controller-url %CONTROLLER_URL%
""")

    # Create offline install script
    with open(os.path.join(STAGE_DIR, "install-offline.bat"), "w") as f:
        f.write("""@echo off
echo Installing PatchMaster Agent (offline/air-gapped)...
pip install --no-index --find-links=python_deps/ -r requirements.txt
echo Installation complete. Run start-agent.bat to start.
pause
""")

    # CI/CD templates
    os.makedirs("cicd", exist_ok=True)
    with open("cicd/jenkins.groovy", "w") as f:
        f.write("""pipeline {
    agent { label 'windows' }
    stages {
        stage('Scan') { steps { bat '.\\start-agent.bat --scan' } }
        stage('Patch') { steps { bat '.\\start-agent.bat --patch' } }
    }
}
""")

    with open("cicd/ansible-playbook.yml", "w") as f:
        f.write("""- hosts: windows_servers
  tasks:
    - win_command: powershell -Command ".\start-agent.bat --scan"
      register: result
""")

    # Create README
    with open("README.txt", "w") as f:
        f.write("""PatchMaster Agent v2.0.0 - Windows
================================

INSTALLATION:
1. Online: Double-click patchmaster-agent-installer.exe
2. Offline: Run install-offline.bat

USAGE:
- Online: start-agent.bat
- Offline: Set OFFLINE=true then start-agent.bat

CI/CD INTEGRATION:
- Jenkins: cicd/jenkins.groovy
- Ansible: cicd/ansible-playbook.yml

PORTS:
- Agent: 8080 (configurable)
- Metrics: 9100 (configurable)
""")

    # Create zip
    zip_path = os.path.join(DIST_DIR, "patch-agent-2.0.0.windows-full.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(STAGE_DIR):
            for f in files:
                full_path = os.path.join(root, f)
                arc_path = os.path.relpath(full_path, STAGE_DIR)
                zf.write(full_path, arc_path)

    # Copy to static
    final_zip = os.path.join(STATIC_DIR, "agent-windows.zip")
    shutil.copy(zip_path, final_zip)

    print(f"=== Built: {final_zip} ===")
    print(f"Size: {os.path.getsize(final_zip) / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    build_windows_full()
