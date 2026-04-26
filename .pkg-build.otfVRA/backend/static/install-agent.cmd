@echo off
setlocal EnableDelayedExpansion
rem Lightweight helper to download + run the Windows installer

if "%~1"=="" (
  set /p MASTER_URL=Enter PatchMaster Master URL (example: http://192.168.1.10:8000^):
) else (
  set "MASTER_URL=%~1"
)

if "%MASTER_URL%"=="" (
  echo [ERROR] MASTER_URL is required.
  exit /b 1
)

rem Strip common PowerShell copy/paste artifacts (backticks, quotes, spaces)
set "MASTER_URL=!MASTER_URL:`=!"
set "MASTER_URL=!MASTER_URL:"=!"
set "MASTER_URL=!MASTER_URL:'=!"
set "MASTER_URL=!MASTER_URL: =!"

rem Normalize controller URL and derive download URL.
if /i "!MASTER_URL:~-5!"==":3000" (
  set "MASTER_URL=!MASTER_URL:~0,-5!:8000"
) else (
  for /f "tokens=1,2 delims=/" %%A in ("!MASTER_URL!") do (
    if /i "%%A//%%B"=="http://" if "!MASTER_URL!"=="http://%%B" set "MASTER_URL=http://%%B:8000"
  )
)

set "DOWNLOAD_URL=%MASTER_URL%"
set "DOWNLOAD_URL=!DOWNLOAD_URL::8000=:3000!"
set "DOWNLOAD_URL=!DOWNLOAD_URL!/download/patchmaster-agent-installer.exe"

set "OUT_FILE=%TEMP%\\PatchMaster-Agent-Installer.exe"

where curl.exe >nul 2>&1 || (
  echo [ERROR] curl.exe not found. Please install curl or download the installer manually.
  exit /b 1
)

echo [INFO] Downloading installer from !DOWNLOAD_URL! ...
curl.exe -fL -o "!OUT_FILE!" "!DOWNLOAD_URL!"
if errorlevel 1 (
  echo [ERROR] Download failed.
  exit /b 1
)

rem Gracefully stop/uninstall existing services to avoid file locks during reinstall
set "INSTALL_DIR=%ProgramFiles%\\PatchMaster-Agent"
if exist "%INSTALL_DIR%\\PatchMaster-Agent.exe" (
  "%INSTALL_DIR%\\PatchMaster-Agent.exe" stop >nul 2>&1
  "%INSTALL_DIR%\\PatchMaster-Agent.exe" uninstall >nul 2>&1
)
if exist "%INSTALL_DIR%\\PatchMaster-Agent-Heartbeat.exe" (
  "%INSTALL_DIR%\\PatchMaster-Agent-Heartbeat.exe" stop >nul 2>&1
  "%INSTALL_DIR%\\PatchMaster-Agent-Heartbeat.exe" uninstall >nul 2>&1
)
rem Best-effort kill of running binaries that may keep files locked
taskkill /F /IM patch-agent.exe >nul 2>&1
taskkill /F /IM patch-agent-heartbeat.exe >nul 2>&1
rem Small wait to let the OS release file handles
ping -n 3 127.0.0.1 >nul

echo [INFO] Running installer...
"!OUT_FILE!" --master-url "!MASTER_URL!" --no-pause
endlocal
