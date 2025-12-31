# Stop Server Script - MyDoctor Backend
# This script stops any process using port 5000
Write-Host "Checking for processes on port 5000..." -ForegroundColor Yellow

$connection = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue

if ($connection) {
    $processId = $connection.OwningProcess
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    
    if ($process) {
        Write-Host "Found process: $($process.ProcessName) (PID: $processId)" -ForegroundColor Cyan
        Stop-Process -Id $processId -Force
        Write-Host "✅ Server stopped successfully!" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Process not found, but port may still be in use" -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ No process found on port 5000" -ForegroundColor Green
}
# Wait a moment and verify
Start-Sleep -Seconds 1
$verify = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
if (-not $verify) {
    Write-Host "✅ Port 5000 is now free" -ForegroundColor Green
} else {
    Write-Host "⚠️ Port 5000 is still in use" -ForegroundColor Red
}
