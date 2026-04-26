<#
.SYNOPSIS
    PatchMaster Agent Installer (Windows) - EXE-based
    No Python, no scheduled tasks. Uses the bundled installer EXE.
#>

param(
    [string]$MasterUrl = $env:MASTER_URL,
    [string]$DownloadUrl = $env:PM_DOWNLOAD_URL,
    [string]$Site = $env:PATCHMASTER_SITE,
    [string]$OutFile = "$env:TEMP\PatchMaster-Agent-Installer.exe"
)

if (-not $MasterUrl -or $MasterUrl.Trim().Length -eq 0) {
    $MasterUrl = Read-Host "Enter PatchMaster Master URL (example: http://192.168.1.10:8000)"
}

if (-not $MasterUrl -or $MasterUrl.Trim().Length -eq 0) {
    Write-Host "[ERROR] MASTER_URL is required." -ForegroundColor Red
    exit 1
}

$MasterUrl = $MasterUrl.Trim().Trim('`','"',"'",' ').Replace(' ', '').TrimEnd('/')
try {
    $uri = [Uri]$MasterUrl
    if (-not $uri.IsDefaultPort -and $uri.Port -eq 3000) {
        $MasterUrl = "$($uri.Scheme)://$($uri.Host):8000"
    } elseif ($uri.IsDefaultPort -and $uri.Scheme -eq 'http') {
        $MasterUrl = "$($uri.Scheme)://$($uri.Host):8000"
    }
} catch {}

if (-not $DownloadUrl -or $DownloadUrl.Trim().Length -eq 0) {
    $DownloadUrl = $MasterUrl.TrimEnd("/")
    if ($DownloadUrl -match ":8000$") { $DownloadUrl = $DownloadUrl -replace ":8000$", ":3000" }
    $DownloadUrl = "$DownloadUrl/download/patchmaster-agent-installer.exe"
}

Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         PatchMaster by YVGROUP Agent Installer         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host "[INFO] Downloading installer from $DownloadUrl..." -ForegroundColor Blue
try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $OutFile -UseBasicParsing -ErrorAction Stop
} catch {
    Write-Host "[ERROR] Failed to download installer EXE." -ForegroundColor Red
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Running installer..." -ForegroundColor Blue
$installDir = Join-Path $env:ProgramFiles 'PatchMaster-Agent'
$hbWrapper = Join-Path $installDir 'PatchMaster-Agent-Heartbeat.exe'
$apiWrapper = Join-Path $installDir 'PatchMaster-Agent.exe'
if (Test-Path $hbWrapper) { & $hbWrapper stop | Out-Null; & $hbWrapper uninstall | Out-Null }
if (Test-Path $apiWrapper) { & $apiWrapper stop | Out-Null; & $apiWrapper uninstall | Out-Null }
Get-Process patch-agent, patch-agent-heartbeat -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

if ($Site -and $Site.Trim().Length -gt 0) {
    & $OutFile --master-url $MasterUrl --site $Site --no-pause
} else {
    & $OutFile --master-url $MasterUrl --no-pause
}
