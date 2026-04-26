@echo off
setlocal enabledelayedexpansion

rem --- Parse MASTER_URL from args: supports plain URL, --master-url <url>, or --master-url=<url> ---
set "MASTER_URL="
:parse
if "%~1"=="" goto parsed
if /I "%~1"=="--master-url" (
  shift
  set "MASTER_URL=%~1"
  goto parsed
)
if /I "%~1:~0,13%"=="--master-url=" (
  set "MASTER_URL=%~1"
  set "MASTER_URL=!MASTER_URL:--master-url=!"
  goto parsed
)
set "MASTER_URL=%~1"
goto parsed

:parsed
if "%MASTER_URL%"=="" if not "%PATCHMASTER_MASTER_URL%"=="" (
  set "MASTER_URL=%PATCHMASTER_MASTER_URL%"
)
if "%MASTER_URL%"=="" (
  set /p MASTER_URL=Enter PatchMaster Master URL (example: http://172.18.194.145:8000^): 
)
if "%MASTER_URL%"=="" (
  echo [ERROR] MASTER_URL is required.
  pause
  exit /b 1
)
set "MASTER_URL=!MASTER_URL:`=!"
set "MASTER_URL=!MASTER_URL:"=!"
set "MASTER_URL=!MASTER_URL:'=!"
set "MASTER_URL=!MASTER_URL: =!"
if /i "!MASTER_URL:~-5!"==":3000" (
  set "MASTER_URL=!MASTER_URL:~0,-5!:8000"
)

set "INSTALL_DIR=%ProgramFiles%\PatchMaster-Agent"
set "DATA_DIR=%ProgramData%\patch-agent"

set "INSTALLER=%~dp0patchmaster-agent-installer.exe"
if not exist "%INSTALLER%" (
  echo [ERROR] patchmaster-agent-installer.exe not found in this folder.
  pause
  exit /b 1
)

echo [INFO] Installing PatchMaster Agent (Administrator required)...
"%INSTALLER%" --master-url "%MASTER_URL%" --no-pause
if errorlevel 1 (
  echo [ERROR] Installer failed.
  pause
  exit /b 1
)

echo [SUCCESS] Installed.
pause
exit /b 0
