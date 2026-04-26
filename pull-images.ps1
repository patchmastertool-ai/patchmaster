# Pull all Docker images for building
Write-Host "Pulling Docker images for all platforms..." -ForegroundColor Cyan
Write-Host ""

$images = @(
    "ubuntu:22.04",
    "debian:12",
    "archlinux:latest",
    "alpine:latest",
    "opensuse/tumbleweed",
    "almalinux:9"
)

$success = 0
$failed = 0

foreach ($image in $images) {
    Write-Host "Pulling $image..." -ForegroundColor Yellow
    
    $result = wsl -d Ubuntu -- sudo docker pull $image 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ $image" -ForegroundColor Green
        $success++
    } else {
        Write-Host "  ✗ $image FAILED" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "  Pulled: $success/$($images.Count)" -ForegroundColor $(if ($success -eq $images.Count) { "Green" } else { "Yellow" })
Write-Host "  Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($success -gt 0) {
    Write-Host "Images ready! Now run:" -ForegroundColor Green
    Write-Host "  .\build-packages.ps1" -ForegroundColor Cyan
}
