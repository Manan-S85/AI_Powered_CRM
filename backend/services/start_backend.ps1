# PowerShell Script to Start Backend
# This prevents terminal hangs by using the safe startup script

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "AI-Powered CRM Backend Startup" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Change to the services directory
Set-Location $PSScriptRoot

# Set UTF-8 encoding for PowerShell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"

# Run the safe startup script
try {
    Write-Host "[INFO] Starting backend server..." -ForegroundColor Yellow
    python windows_safe_start.py
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[OK] Backend started successfully" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "[ERROR] Backend failed to start (Exit Code: $LASTEXITCODE)" -ForegroundColor Red
    }
} catch {
    Write-Host ""
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
}

# Pause if running in a new window
if ($Host.Name -eq "ConsoleHost") {
    Write-Host ""
    Write-Host "Press any key to continue..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
