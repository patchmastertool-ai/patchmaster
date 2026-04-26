import os
import shutil
import subprocess
from pathlib import Path


def _write_sed(target_exe: Path, stage_dir: Path) -> Path:
    sed = stage_dir / "patchmaster-agent-installer.sed"
    target_exe_str = str(target_exe).replace("\\", "\\\\")
    content = f"""[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=0
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName={target_exe_str}
FriendlyName=PatchMaster Agent Installer
AppLaunched=install.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=install.cmd
UserQuietInstCmd=install.cmd
SourceFiles=SourceFiles
[SourceFiles]
SourceFiles0=.
[SourceFiles0]
agent-windows.zip=
install.cmd=
"""
    sed.write_text(content, encoding="utf-8")
    return sed


def main():
    project_root = Path(__file__).resolve().parents[1]
    backend_static = project_root / "backend" / "static"
    zip_path = backend_static / "agent-windows.zip"
    if not zip_path.exists():
        raise SystemExit(f"Missing: {zip_path}")

    payload_cmd = project_root / "agent" / "windows_installer_payload" / "install.cmd"
    if not payload_cmd.exists():
        raise SystemExit(f"Missing: {payload_cmd}")

    stage_dir = project_root / "agent" / "dist" / "iexpress_stage"
    if stage_dir.exists():
        shutil.rmtree(stage_dir, ignore_errors=True)
    stage_dir.mkdir(parents=True, exist_ok=True)

    shutil.copy2(zip_path, stage_dir / "agent-windows.zip")
    shutil.copy2(payload_cmd, stage_dir / "install.cmd")

    out_exe = backend_static / "patchmaster-agent-installer.exe"
    sed = _write_sed(out_exe, stage_dir)

    iexpress = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "iexpress.exe"
    if not iexpress.exists():
        raise SystemExit("iexpress.exe not found")

    subprocess.run([str(iexpress), "/N", "/Q", str(sed)], check=True, cwd=str(stage_dir))
    if not out_exe.exists():
        raise SystemExit("Installer EXE was not created")
    print(f"Created: {out_exe}")


if __name__ == "__main__":
    main()

