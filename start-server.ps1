# Start Server Script - MyDoctor Backend
# This script checks if port 5000 is free and starts the server

Write-Host "Checking if port 5000 is available..." -ForegroundColor Yellow

$connection = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue

if ($connection) {
    Write-Host "❌ Port 5000 is already in use!" -ForegroundColor Red
    Write-Host "Please stop the existing server first:" -ForegroundColor Yellow
    Write-Host "  .\stop-server.ps1" -ForegroundColor Cyan
    Write-Host "Or use a different port by changing PORT in .env file" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Port 5000 is free" -ForegroundColor Green
Write-Host "Starting server..." -ForegroundColor Yellow
Write-Host ""

# Start the server
npm start
