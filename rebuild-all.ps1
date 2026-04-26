#!/usr/bin/env pwsh
###############################################################################
# Rebuild All Packages - Complete rebuild with image pull
###############################################################################

Write-Host "=" -NoNewline -ForegroundColor Blue
Write-Host ("=" * 69) -ForegroundColor Blue
Write-Host "PatchMaster - Rebuild All Packages" -ForegroundColor Cyan
Write-Host "=" -NoNewline -ForegroundColor Blue
Write-Host ("=" * 69) -ForegroundColor Blue
Write-Host ""

# Clean old packages
Write-Host "[INFO] Cleaning old packages..." -ForegroundColor Blue
Remove-Item backend/static/agent-latest.* -ErrorAction SilentlyContinue
Remove-Item agent/dist/agent-latest.* -ErrorAction SilentlyContinue
Remove-Item agent/dist/patchmaster-agent-* -ErrorAction SilentlyContinue

Write-Host "[INFO] Ensuring Docker images are pulled..." -ForegroundColor Blue
Write-Host ""

$images = @(
    "ubuntu:22.04",
    "debian:12",
    "archlinux:latest",
    "alpine:latest",
    "opensuse/tumbleweed",
    "almalinux:9"
)

foreach ($image in $images) {
    Write-Host "  Checking $image..." -ForegroundColor Gray
    $result = wsl -d Ubuntu -- bash -c "echo 'sona' | sudo -S docker images -q $image" 2>$null
    if (-not $result) {
        Write-Host "    Pulling $image..." -ForegroundColor Yellow
        wsl -d Ubuntu -- bash -c "echo 'sona' | sudo -S docker pull $image" | Out-Null
    } else {
        Write-Host "    Already present" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "[INFO] Starting build process..." -ForegroundColor Blue
Write-Host ""

# Run the build
python scripts/build_all_platforms.py

$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "[SUCCESS] Build complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Checking packages..." -ForegroundColor Cyan
    .\check-build-status.ps1
} else {
    Write-Host "[ERROR] Build failed with exit code $exitCode" -ForegroundColor Red
}

exit $exitCode
