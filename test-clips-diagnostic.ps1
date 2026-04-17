# PowerShell script to diagnose clip loading issues
# Requires: npm run dev running on localhost:3000

Write-Host "=== BJJMAXXING Clip Loading Diagnostic ===" -ForegroundColor Green
Write-Host ""

# Check if dev server is running
$devServer = $null
try {
    $devServer = Invoke-WebRequest -Uri "http://localhost:3000" -Method HEAD -TimeoutSec 5 -ErrorAction SilentlyContinue
} catch {}

if (-not $devServer) {
    Write-Host "ERROR: Dev server not running on http://localhost:3000" -ForegroundColor Red
    Write-Host "Please run 'npm run dev' first" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Dev server is running" -ForegroundColor Green
Write-Host ""

# Run the Playwright test
Write-Host "Running Playwright test..." -ForegroundColor Cyan
Write-Host "This will open a browser and log in with admin credentials" -ForegroundColor Gray
Write-Host ""

npx playwright test e2e/debug-incognito-session.spec.ts --headed

Write-Host ""
Write-Host "Test completed. Check test-results/ folder for screenshots." -ForegroundColor Green
