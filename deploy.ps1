# ============================================================
#  Saga Project — Windows Deploy Script (PowerShell)
#  Target: EC2 Ubuntu  18.235.55.73
#  Usage : .\deploy.ps1 [-PemFile <path-to-pem>]
# ============================================================
param(
    [string]$PemFile = ".\saga_project.pem"
)

$ErrorActionPreference = "Stop"

$SERVER  = "ubuntu@18.235.55.73"
$ROOT    = Split-Path -Parent $MyInvocation.MyCommand.Path   # punjab-government/
$TMP     = "$env:TEMP\saga_deploy_$(Get-Date -Format 'yyyyMMddHHmmss')"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Saga Project — EC2 Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Server : $SERVER"
Write-Host "  PEM    : $PemFile"
Write-Host ""

# ── Validate PEM file ─────────────────────────────────────────────────────────
if (-not (Test-Path $PemFile)) {
    Write-Error "PEM file not found: $PemFile`nUsage: .\deploy.ps1 -PemFile 'C:\path\to\saga_project.pem'"
    exit 1
}

# ── Fix PEM permissions (SSH requires restricted access) ─────────────────────
Write-Host "[1/5] Fixing PEM file permissions..." -ForegroundColor Yellow
$fullPemPath = (Resolve-Path $PemFile).Path
icacls $fullPemPath /inheritance:r | Out-Null
icacls $fullPemPath /grant:r "${env:USERNAME}:(R)" | Out-Null
Write-Host "      Done."

# ── Create temp staging directory ────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path $TMP | Out-Null

# ── Package each service using tar (available on Windows 10+) ────────────────
Write-Host "[2/5] Packaging services (excluding node_modules / __pycache__ / venv)..." -ForegroundColor Yellow

# backend — Node.js (exclude node_modules)
Write-Host "      → backend"
Push-Location "$ROOT\backend"
tar --exclude='./node_modules' --exclude='./__pycache__' --exclude='./.git' `
    -czf "$TMP\backend.tar.gz" .
Pop-Location

# backend_ml — FastAPI (exclude venv, __pycache__, artifacts)
Write-Host "      → backend_ml"
Push-Location "$ROOT\backend_ml"
tar --exclude='./__pycache__' --exclude='./venv' --exclude='./.venv' `
    --exclude='./artifacts' --exclude='./.git' `
    -czf "$TMP\backend_ml.tar.gz" .
Pop-Location

# location_service — Flask (exclude venv, __pycache__)
Write-Host "      → location_service"
Push-Location "$ROOT\location_service"
tar --exclude='./__pycache__' --exclude='./venv' --exclude='./.venv' `
    --exclude='./.git' `
    -czf "$TMP\location_service.tar.gz" .
Pop-Location

Write-Host "      Packaging complete."

# ── Upload archives + setup script ───────────────────────────────────────────
Write-Host "[3/5] Uploading to server..." -ForegroundColor Yellow
scp -i $fullPemPath -o StrictHostKeyChecking=no `
    "$TMP\backend.tar.gz" `
    "$TMP\backend_ml.tar.gz" `
    "$TMP\location_service.tar.gz" `
    "$ROOT\server_setup.sh" `
    "${SERVER}:~/"
Write-Host "      Upload complete."

# ── Run setup script on server ────────────────────────────────────────────────
Write-Host "[4/5] Running server_setup.sh on EC2..." -ForegroundColor Yellow
ssh -i $fullPemPath -o StrictHostKeyChecking=no $SERVER "chmod +x ~/server_setup.sh && bash ~/server_setup.sh"

# ── Clean up local temp files ─────────────────────────────────────────────────
Write-Host "[5/5] Cleaning up temp files..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $TMP

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Backend API     : http://18.235.55.73:8000"
Write-Host "  ML Risk Service : http://18.235.55.73:8006"
Write-Host "  Location Svc    : http://18.235.55.73:5003"
Write-Host ""
Write-Host "IMPORTANT NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Upload your backend .env file:"
Write-Host "       scp -i $PemFile .env ubuntu@18.235.55.73:~/app/backend/.env"
Write-Host "  2. Restart the backend after uploading .env:"
Write-Host "       ssh -i $PemFile ubuntu@18.235.55.73 'pm2 restart backend'"
Write-Host "  3. Ensure EC2 Security Group allows inbound TCP on ports 8000, 8006, 5003"
Write-Host "  4. Redeploy frontend on Vercel to pick up the new vercel.json (IP already updated)"
Write-Host ""
