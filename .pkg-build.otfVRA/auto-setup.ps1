# PatchMaster Automated Setup Script for Windows
# Handles all setup, dependencies, and common issues automatically

$ErrorActionPreference = "Stop"

# Configuration
$PYTHON_MIN_VERSION = "3.10"
$NODE_MIN_VERSION = "18"
$PROJECT_ROOT = Get-Location
$LOG_FILE = "setup-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

# Logging functions
function Log {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage -ForegroundColor Green
    Add-Content -Path $LOG_FILE -Value $logMessage
}

function Error-Log {
    param($Message)
    $logMessage = "[ERROR] $Message"
    Write-Host $logMessage -ForegroundColor Red
    Add-Content -Path $LOG_FILE -Value $logMessage
}

function Warn-Log {
    param($Message)
    $logMessage = "[WARNING] $Message"
    Write-Host $logMessage -ForegroundColor Yellow
    Add-Content -Path $LOG_FILE -Value $logMessage
}

function Info-Log {
    param($Message)
    $logMessage = "[INFO] $Message"
    Write-Host $logMessage -ForegroundColor Cyan
    Add-Content -Path $LOG_FILE -Value $logMessage
}

# Check if command exists
function Test-Command {
    param($Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# Compare versions
function Test-VersionGreaterOrEqual {
    param($Version1, $Version2)
    [version]$v1 = $Version1
    [version]$v2 = $Version2
    return $v1 -ge $v2
}

# Check Python
function Test-Python {
    Log "Checking Python installation..."
    
    $pythonCmd = $null
    if (Test-Command "python") {
        $pythonCmd = "python"
    } elseif (Test-Command "python3") {
        $pythonCmd = "python3"
    } else {
        Error-Log "Python not found. Please install Python $PYTHON_MIN_VERSION+"
        return $false
    }
    
    $pythonVersion = & $pythonCmd --version 2>&1 | Select-String -Pattern "(\d+\.\d+\.\d+)" | ForEach-Object { $_.Matches.Groups[1].Value }
    Info-Log "Found Python $pythonVersion"
    
    if (Test-VersionGreaterOrEqual $pythonVersion $PYTHON_MIN_VERSION) {
        Log "✓ Python version OK"
        $script:PYTHON_CMD = $pythonCmd
        return $true
    } else {
        Error-Log "Python $PYTHON_MIN_VERSION+ required, found $pythonVersion"
        return $false
    }
}

# Check Node.js
function Test-Node {
    Log "Checking Node.js installation..."
    
    if (!(Test-Command "node")) {
        Warn-Log "Node.js not found. Please install Node.js $NODE_MIN_VERSION+ from https://nodejs.org/"
        return $false
    }
    
    $nodeVersion = node --version 2>&1 | ForEach-Object { $_ -replace 'v', '' }
    Info-Log "Found Node.js $nodeVersion"
    
    if (Test-VersionGreaterOrEqual $nodeVersion $NODE_MIN_VERSION) {
        Log "✓ Node.js version OK"
        return $true
    } else {
        Warn-Log "Node.js $NODE_MIN_VERSION+ recommended, found $nodeVersion"
        return $true
    }
}

# Setup Python virtual environment
function Setup-PythonVenv {
    param($Dir, $VenvName = ".venv")
    
    Log "Setting up Python virtual environment in $Dir..."
    
    Set-Location "$PROJECT_ROOT\$Dir"
    
    if (Test-Path $VenvName) {
        Warn-Log "Virtual environment already exists, skipping creation"
    } else {
        & $script:PYTHON_CMD -m venv $VenvName
        if ($LASTEXITCODE -ne 0) {
            Error-Log "Failed to create virtual environment"
            return $false
        }
        Log "✓ Virtual environment created"
    }
    
    # Activate venv
    & ".\$VenvName\Scripts\Activate.ps1"
    
    # Upgrade pip
    python -m pip install --upgrade pip setuptools wheel 2>&1 | Tee-Object -Append -FilePath "$PROJECT_ROOT\$LOG_FILE"
    
    Log "✓ Virtual environment ready"
    Set-Location $PROJECT_ROOT
    return $true
}

# Install Python dependencies
function Install-PythonDeps {
    param($Dir, $VenvName = ".venv")
    
    Log "Installing Python dependencies for $Dir..."
    
    Set-Location "$PROJECT_ROOT\$Dir"
    & ".\$VenvName\Scripts\Activate.ps1"
    
    # Check if we have local wheels
    if (Test-Path "$PROJECT_ROOT\vendor\wheels") {
        Info-Log "Using local wheel files (offline mode)"
        pip install --no-index --find-links="$PROJECT_ROOT\vendor\wheels" -r requirements.txt 2>&1 | Tee-Object -Append -FilePath "$PROJECT_ROOT\$LOG_FILE"
        if ($LASTEXITCODE -ne 0) {
            Warn-Log "Failed with local wheels, trying online installation..."
            pip install -r requirements.txt 2>&1 | Tee-Object -Append -FilePath "$PROJECT_ROOT\$LOG_FILE"
        }
    } else {
        Info-Log "Installing from PyPI (online mode)"
        pip install -r requirements.txt 2>&1 | Tee-Object -Append -FilePath "$PROJECT_ROOT\$LOG_FILE"
    }
    
    Log "✓ Python dependencies installed for $Dir"
    Set-Location $PROJECT_ROOT
    return $true
}

# Setup Backend
function Setup-Backend {
    Log "=== Setting up Backend ==="
    
    if (!(Setup-PythonVenv "backend")) { return $false }
    if (!(Install-PythonDeps "backend")) { return $false }
    
    # Create .env if not exists
    if (!(Test-Path "backend\.env")) {
        Log "Creating backend\.env from template..."
        $secretKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
        $licenseKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
        
        @"
# Database
DATABASE_URL=postgresql://patchmaster:patchmaster@localhost:5432/patchmaster

# Security
PM_SECRET_KEY=$secretKey
LICENSE_SIGN_KEY=$licenseKey

# Redis (optional)
REDIS_URL=redis://localhost:6379

# CORS (adjust for your domain)
CORS_ORIGINS=["http://localhost:5173","http://localhost"]
"@ | Out-File -FilePath "backend\.env" -Encoding UTF8
        Log "✓ Created backend\.env (please review and update)"
    }
    
    Log "✓ Backend setup complete"
    return $true
}

# Setup Frontend
function Setup-Frontend {
    Log "=== Setting up Frontend ==="
    
    Set-Location "$PROJECT_ROOT\frontend"
    
    # Check if node_modules exists
    if (Test-Path "node_modules") {
        Info-Log "node_modules already exists, skipping npm install"
    } else {
        Log "Installing Node.js dependencies..."
        npm install 2>&1 | Tee-Object -Append -FilePath "$PROJECT_ROOT\$LOG_FILE"
        if ($LASTEXITCODE -ne 0) {
            Error-Log "npm install failed"
            return $false
        }
    }
    
    # Create .env if not exists
    if (!(Test-Path ".env")) {
        Log "Creating frontend\.env from template..."
        @"
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
"@ | Out-File -FilePath ".env" -Encoding UTF8
        Log "✓ Created frontend\.env"
    }
    
    Set-Location $PROJECT_ROOT
    Log "✓ Frontend setup complete"
    return $true
}

# Setup Agent
function Setup-Agent {
    Log "=== Setting up Agent ==="
    
    if (!(Setup-PythonVenv "agent")) { return $false }
    if (!(Install-PythonDeps "agent")) { return $false }
    
    Log "✓ Agent setup complete"
    return $true
}

# Setup Vendor
function Setup-Vendor {
    Log "=== Setting up Vendor Portal ==="
    
    if (!(Setup-PythonVenv "vendor")) { return $false }
    if (!(Install-PythonDeps "vendor")) { return $false }
    
    # Create .env if not exists
    if (!(Test-Path "vendor\.env")) {
        Log "Creating vendor\.env from template..."
        $signKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
        $encryptKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
        $flaskKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
        
        @"
# Database
DATABASE_URL=postgresql://vendor:vendor@localhost:5432/vendor

# License Keys
LICENSE_SIGN_KEY=$signKey
LICENSE_ENCRYPT_KEY=$encryptKey

# Flask
FLASK_SECRET_KEY=$flaskKey
"@ | Out-File -FilePath "vendor\.env" -Encoding UTF8
        Log "✓ Created vendor\.env (please review and update)"
    }
    
    Log "✓ Vendor portal setup complete"
    return $true
}

# Create startup scripts
function New-StartupScripts {
    Log "=== Creating Startup Scripts ==="
    
    # Backend startup script
    @"
@echo off
cd backend
call .venv\Scripts\activate.bat
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"@ | Out-File -FilePath "start-backend.cmd" -Encoding ASCII
    Log "✓ Created start-backend.cmd"
    
    # Frontend startup script
    @"
@echo off
cd frontend
npm run dev
"@ | Out-File -FilePath "start-frontend.cmd" -Encoding ASCII
    Log "✓ Created start-frontend.cmd"
    
    # Vendor startup script
    @"
@echo off
cd vendor
call .venv\Scripts\activate.bat
python app.py
"@ | Out-File -FilePath "start-vendor.cmd" -Encoding ASCII
    Log "✓ Created start-vendor.cmd"
}

# Print summary
function Show-Summary {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "  PatchMaster Setup Complete!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "✓ Backend setup complete" -ForegroundColor Green
    Write-Host "✓ Frontend setup complete" -ForegroundColor Green
    Write-Host "✓ Agent setup complete" -ForegroundColor Green
    Write-Host "✓ Vendor portal setup complete" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Review and update configuration files:" -ForegroundColor White
    Write-Host "   - backend\.env" -ForegroundColor Cyan
    Write-Host "   - frontend\.env" -ForegroundColor Cyan
    Write-Host "   - vendor\.env" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Start services:" -ForegroundColor White
    Write-Host "   start-backend.cmd      # Start backend" -ForegroundColor Cyan
    Write-Host "   start-frontend.cmd     # Start frontend" -ForegroundColor Cyan
    Write-Host "   start-vendor.cmd       # Start vendor portal" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "3. Access the application:" -ForegroundColor White
    Write-Host "   Frontend:  http://localhost:5173" -ForegroundColor Cyan
    Write-Host "   Backend:   http://localhost:8000" -ForegroundColor Cyan
    Write-Host "   API Docs:  http://localhost:8000/docs" -ForegroundColor Cyan
    Write-Host "   Vendor:    http://localhost:5001" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "4. Or use Docker:" -ForegroundColor White
    Write-Host "   docker-compose up -d" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Setup log saved to: $LOG_FILE" -ForegroundColor Yellow
    Write-Host ""
}

# Main function
function Main {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "  PatchMaster Automated Setup" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    
    Log "Starting automated setup..."
    Log "Project root: $PROJECT_ROOT"
    
    # Check prerequisites
    if (!(Test-Python)) { exit 1 }
    if (!(Test-Node)) { Warn-Log "Node.js check failed, but continuing..." }
    
    # Setup components
    if (!(Setup-Backend)) { Error-Log "Backend setup failed"; exit 1 }
    if (!(Setup-Frontend)) { Error-Log "Frontend setup failed"; exit 1 }
    if (!(Setup-Agent)) { Warn-Log "Agent setup failed, but continuing..." }
    if (!(Setup-Vendor)) { Warn-Log "Vendor setup failed, but continuing..." }
    
    # Create helper scripts
    New-StartupScripts
    
    # Print summary
    Show-Summary
    
    Log "Setup completed successfully!"
}

# Run main function
try {
    Main
} catch {
    Error-Log "Setup failed: $_"
    Error-Log "Check $LOG_FILE for details"
    exit 1
}
