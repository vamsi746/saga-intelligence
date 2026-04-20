#!/bin/bash
# ============================================================
#  Saga Project — Server Setup Script
#  Runs on: Ubuntu EC2 (18.235.55.73)
#  Services: backend (Node/PM2), backend_ml (FastAPI/uvicorn),
#            location_service (Flask/gunicorn)
# ============================================================
set -e

APP_DIR=~/app
SERVER_IP="18.235.55.73"

echo ""
echo "========================================"
echo "  Saga Project — Server Setup"
echo "========================================"
echo ""

# ── [1] System packages ───────────────────────────────────────────────────────
echo "[1/9] Updating system & installing base packages..."
sudo apt-get update -y
sudo apt-get install -y curl git python3 python3-pip python3-venv build-essential

# ── [2] Node.js 20 ───────────────────────────────────────────────────────────
echo "[2/9] Installing Node.js 20..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "  Node: $(node -v)   NPM: $(npm -v)"

# ── [3] PM2 ──────────────────────────────────────────────────────────────────
echo "[3/9] Installing PM2..."
sudo npm install -g pm2

# ── [4] Create app directories & extract archives ────────────────────────────
echo "[4/9] Extracting service archives..."
mkdir -p "$APP_DIR/backend" "$APP_DIR/backend_ml" "$APP_DIR/location_service"

tar -xzf ~/backend.tar.gz         -C "$APP_DIR/backend"
tar -xzf ~/backend_ml.tar.gz      -C "$APP_DIR/backend_ml"
tar -xzf ~/location_service.tar.gz -C "$APP_DIR/location_service"

# ── [5] Backend — Node.js dependencies ───────────────────────────────────────
echo "[5/9] Installing backend Node.js dependencies..."
cd "$APP_DIR/backend"
npm install --omit=dev

if [ ! -f .env ]; then
    echo ""
    echo "  ⚠  WARNING: $APP_DIR/backend/.env not found!"
    echo "     The backend will fail to start without it."
    echo "     Create it with at minimum:"
    echo "       PORT=8000"
    echo "       MONGO_URI=<your MongoDB connection string>"
    echo "       JWT_SECRET=<a strong random secret>"
    echo ""
fi

# ── [6] Backend ML — Python venv ─────────────────────────────────────────────
echo "[6/9] Setting up backend_ml Python venv..."
cd "$APP_DIR/backend_ml"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
deactivate

# ── [7] Location Service — Python venv ───────────────────────────────────────
echo "[7/9] Setting up location_service Python venv..."
cd "$APP_DIR/location_service"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
deactivate

# ── [8] PM2 ecosystem config ─────────────────────────────────────────────────
echo "[8/9] Writing PM2 ecosystem config..."
cat > "$APP_DIR/ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [
    // ── Node.js Backend (port 8000) ──────────────────────────────────────────
    {
      name: 'backend',
      cwd: '/home/ubuntu/app/backend',
      script: 'src/index.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: 8000,
      },
      max_memory_restart: '1G',
      restart_delay: 3000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── FastAPI ML Service (port 8006) ───────────────────────────────────────
    {
      name: 'backend_ml',
      cwd: '/home/ubuntu/app/backend_ml',
      script: 'venv/bin/uvicorn',
      args: 'api.risk_service:app --host 0.0.0.0 --port 8006 --workers 1',
      interpreter: 'none',
      env: {
        FORCE_CPU: 'true',
      },
      max_memory_restart: '2G',
      restart_delay: 5000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ── Flask Location Service (port 5003) ───────────────────────────────────
    {
      name: 'location_service',
      cwd: '/home/ubuntu/app/location_service',
      script: 'venv/bin/gunicorn',
      args: '-w 2 -b 0.0.0.0:5003 app:app',
      interpreter: 'none',
      max_memory_restart: '512M',
      restart_delay: 3000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
EOF

# ── [9] Start all services ────────────────────────────────────────────────────
echo "[9/9] Starting all services with PM2..."
cd "$APP_DIR"

# Stop any existing PM2 processes cleanly
pm2 delete all 2>/dev/null || true

pm2 start ecosystem.config.js

# Persist PM2 across reboots
pm2 save
(pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>&1 | tail -1 | sudo bash) || true

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         Deployment Complete! ✓           ║"
echo "╠══════════════════════════════════════════╣"
pm2 list
echo "╠══════════════════════════════════════════╣"
echo "║  Backend API     →  http://$SERVER_IP:8000"
echo "║  ML Risk Service →  http://$SERVER_IP:8006"
echo "║  Location Svc    →  http://$SERVER_IP:5003"
echo "╠══════════════════════════════════════════╣"
echo "║  Useful commands:"
echo "║    pm2 logs backend"
echo "║    pm2 logs backend_ml"
echo "║    pm2 logs location_service"
echo "║    pm2 restart all"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "⚠  NEXT STEP: Upload your .env file to ~/app/backend/.env"
echo "   then run: pm2 restart backend"
echo ""
