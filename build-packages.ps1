###############################################################################
# PatchMaster Unified Package Builder (PowerShell)
# Single script to build all package types
###############################################################################

param(
    [string]$Version = "2.0.0"
)

$ErrorActionPreference = "Stop"

function Write-Log { param([string]$msg) Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Write-Success { param([string]$msg) Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "[WARNING] $msg" -ForegroundColor Yellow }
function Write-Error { param([string]$msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

function Show-Banner {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║                                                            ║" -ForegroundColor Cyan
    Write-Host "║         PatchMaster Unified Package Builder v$Version        ║" -ForegroundColor Cyan
    Write-Host "║                                                            ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Show-Menu {
    Write-Host "Select package type to build:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  1) Customer Package       " -NoNewline -ForegroundColor Green
    Write-Host "(External - Ship to customers)" -ForegroundColor Yellow
    Write-Host "     Output: dist/patchmaster-$Version.zip"
    Write-Host "     Size: ~100-150 MB"
    Write-Host ""
    Write-Host "  2) Vendor Package         " -NoNewline -ForegroundColor Green
    Write-Host "(External - Ship to vendors/MSPs)" -ForegroundColor Yellow
    Write-Host "     Output: vendor/dist/patchmaster-vendor-$Version.tar.gz"
    Write-Host "     Size: ~5-10 MB"
    Write-Host ""
    Write-Host "  3) Developer Kit          " -NoNewline -ForegroundColor Green
    Write-Host "(Internal - NEVER ship externally)" -ForegroundColor Red
    Write-Host "     Output: dist/developer/patchmaster-developer-kit-$Version.tar.gz"
    Write-Host "     Size: ~200-300 MB"
    Write-Host ""
    Write-Host "  4) Build All Packages     " -NoNewline -ForegroundColor Green
    Write-Host "(Customer + Vendor + Developer)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  5) Build External Only    " -NoNewline -ForegroundColor Green
    Write-Host "(Customer + Vendor)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  0) Exit" -ForegroundColor Green
    Write-Host ""
}

function Invoke-CustomerPackageBuild {
    Write-Log "Building Customer Package..."
    Write-Host ""

    if (Get-Command wsl -ErrorAction SilentlyContinue) {
        try {
            wsl bash -lc "cd $(wsl wslpath -a '$PWD') && bash packaging/build-package.sh --output dist --version '$Version'"
            Write-Success "Customer package built successfully"
            return $true
        } catch {
            Write-Error "Customer package build failed: $_"
            return $false
        }
    } else {
        Write-Error "WSL not available. Please install WSL or use Linux"
        return $false
    }
}

function Invoke-VendorPackageBuild {
    Write-Log "Building Vendor Package..."
    Write-Host ""
    
    if (Get-Command wsl -ErrorAction SilentlyContinue) {
        try {
            wsl bash -c "cd $(wsl wslpath -a '$PWD') && ./build-packages.sh $Version" -c "2"
            Write-Success "Vendor package built successfully"
            return $true
        } catch {
            Write-Error "Vendor package build failed: $_"
            return $false
        }
    } else {
        Write-Error "WSL not available. Vendor package requires Linux/WSL"
        return $false
    }
}

function Invoke-DeveloperKitBuild {
    Write-Warn "⚠️  Building Developer Kit (INTERNAL USE ONLY)"
    Write-Warn "⚠️  This package contains source code and must NEVER be distributed externally"
    Write-Host ""
    
    if (Get-Command wsl -ErrorAction SilentlyContinue) {
        try {
            wsl bash -c "cd $(wsl wslpath -a '$PWD') && ./build-packages.sh $Version" -c "3"
            Write-Success "Developer kit built successfully"
            Write-Warn "⚠️  Remember: NEVER distribute this package externally"
            return $true
        } catch {
            Write-Error "Developer kit build failed: $_"
            return $false
        }
    } else {
        Write-Error "WSL not available. Developer kit requires Linux/WSL"
        return $false
    }
}

function Invoke-AllBuilds {
    Write-Log "Building ALL packages..."
    Write-Host ""
    
    if (Get-Command wsl -ErrorAction SilentlyContinue) {
        try {
            wsl bash -c "cd $(wsl wslpath -a '$PWD') && echo '4' | ./build-packages.sh $Version"
            Write-Success "All packages built successfully!"
            Show-Summary
            return $true
        } catch {
            Write-Error "Package build failed: $_"
            return $false
        }
    } else {
        Write-Error "WSL not available. Please install WSL or use Linux"
        return $false
    }
}

function Invoke-ExternalOnlyBuilds {
    Write-Log "Building EXTERNAL packages only (Customer + Vendor)..."
    Write-Host ""
    
    if (Get-Command wsl -ErrorAction SilentlyContinue) {
        try {
            wsl bash -c "cd $(wsl wslpath -a '$PWD') && echo '5' | ./build-packages.sh $Version"
            Write-Success "External packages built successfully!"
            Show-ExternalSummary
            return $true
        } catch {
            Write-Error "Package build failed: $_"
            return $false
        }
    } else {
        Write-Error "WSL not available. Please install WSL or use Linux"
        return $false
    }
}

function Show-Summary {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║                    BUILD SUMMARY                           ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "✅ External Packages (Safe to distribute):" -ForegroundColor Green
    
    if (Test-Path "dist/patchmaster-$Version.tar.gz") {
        $size = [math]::Round((Get-Item "dist/patchmaster-$Version.tar.gz").Length / 1MB, 2)
        Write-Host "   📦 Customer: dist/patchmaster-$Version.tar.gz ($size MB)"
    }
    
    if (Test-Path "dist/patchmaster-vendor-$Version.tar.gz") {
        $size = [math]::Round((Get-Item "dist/patchmaster-vendor-$Version.tar.gz").Length / 1MB, 2)
        Write-Host "   📦 Vendor:   dist/patchmaster-vendor-$Version.tar.gz ($size MB)"
    }
    
    Write-Host ""
    Write-Host "❌ Internal Package (NEVER distribute):" -ForegroundColor Red
    
    if (Test-Path "dist/developer/patchmaster-developer-kit-$Version.tar.gz") {
        $size = [math]::Round((Get-Item "dist/developer/patchmaster-developer-kit-$Version.tar.gz").Length / 1MB, 2)
        Write-Host "   📦 Developer: dist/developer/patchmaster-developer-kit-$Version.tar.gz ($size MB)"
    }
    
    Write-Host ""
}

function Show-ExternalSummary {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║              EXTERNAL PACKAGES SUMMARY                     ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "✅ Ready to distribute:" -ForegroundColor Green
    
    if (Test-Path "dist/patchmaster-$Version.tar.gz") {
        $size = [math]::Round((Get-Item "dist/patchmaster-$Version.tar.gz").Length / 1MB, 2)
        Write-Host "   📦 Customer: dist/patchmaster-$Version.tar.gz ($size MB)"
    }
    
    if (Test-Path "vendor/dist/patchmaster-vendor-$Version.tar.gz") {
        $size = [math]::Round((Get-Item "vendor/dist/patchmaster-vendor-$Version.tar.gz").Length / 1MB, 2)
        Write-Host "   📦 Vendor:   vendor/dist/patchmaster-vendor-$Version.tar.gz ($size MB)"
    }
    
    Write-Host ""
}

# Main script
Clear-Host
Show-Banner

if (-not $Version) {
    Write-Log "No version specified, using default: 2.0.0"
    $Version = "2.0.0"
    Write-Host ""
}

Write-Host ""
Write-Host "NOTE: This PowerShell wrapper delegates to build-packages.sh via WSL" -ForegroundColor Yellow
Write-Host "For best experience, run build-packages.sh directly in WSL/Linux" -ForegroundColor Yellow
Write-Host ""

# Interactive mode
while ($true) {
    Show-Menu
    $choice = Read-Host "Enter your choice [0-5]"
    Write-Host ""
    
    switch ($choice) {
        "1" {
            Invoke-CustomerPackageBuild | Out-Null
            Write-Host ""
            Read-Host "Press Enter to continue"
        }
        "2" {
            Invoke-VendorPackageBuild | Out-Null
            Write-Host ""
            Read-Host "Press Enter to continue"
        }
        "3" {
            Write-Warn "⚠️  You are about to build the Developer Kit"
            Write-Warn "⚠️  This package contains source code and internal documentation"
            $confirm = Read-Host "Are you sure? (yes/no)"
            if ($confirm -eq "yes") {
                Invoke-DeveloperKitBuild | Out-Null
            } else {
                Write-Warn "Developer kit build cancelled"
            }
            Write-Host ""
            Read-Host "Press Enter to continue"
        }
        "4" {
            Invoke-AllBuilds | Out-Null
            Write-Host ""
            Read-Host "Press Enter to continue"
        }
        "5" {
            Invoke-ExternalOnlyBuilds | Out-Null
            Write-Host ""
            Read-Host "Press Enter to continue"
        }
        "0" {
            Write-Log "Exiting..."
            exit 0
        }
        default {
            Write-Error "Invalid choice. Please select 0-5."
            Start-Sleep -Seconds 2
        }
    }
    
    Clear-Host
    Show-Banner
}
