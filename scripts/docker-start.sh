#!/bin/sh
set -eu

export PORT="${PORT:-4000}"
export NODE_ENV="${NODE_ENV:-development}"
export DATA_LAYER="${DATA_LAYER:-mock}"
export IMAGE_STORAGE="${IMAGE_STORAGE:-mock}"
export ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-http://localhost:5173,http://127.0.0.1:5173}"
export JWT_SECRET="${JWT_SECRET:-dev-phase-2-secret}"
export JWT_COOKIE_NAME="${JWT_COOKIE_NAME:-perl_session}"
export JWT_EXPIRES_IN_SECONDS="${JWT_EXPIRES_IN_SECONDS:-28800}"
export COOKIE_SECURE="${COOKIE_SECURE:-false}"
export VITE_API_URL="${VITE_API_URL:-http://localhost:4000}"
export DB_HOST="${DB_HOST:-mysql}"
export DB_PORT="${DB_PORT:-3306}"
export DB_USER="${DB_USER:-perl}"
export DB_PASSWORD="${DB_PASSWORD:-perl_dev_password}"
export DB_NAME="${DB_NAME:-perl}"
export DB_SSL="${DB_SSL:-false}"
export AWS_REGION="${AWS_REGION:-ap-southeast-1}"
export S3_BUCKET="${S3_BUCKET:-}"
export S3_PUBLIC_BASE_URL="${S3_PUBLIC_BASE_URL:-}"
export WAIT_FOR_MYSQL="${WAIT_FOR_MYSQL:-auto}"

if [ "$WAIT_FOR_MYSQL" = "true" ] || { [ "$WAIT_FOR_MYSQL" = "auto" ] && [ "$DATA_LAYER" = "db" ]; }; then
  sh /app/scripts/wait-for-mysql.sh
fi

cd /app/perl-api
npm run dev &
API_PID=$!

cd /app/perl-rfid-frontend
npm run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

cleanup() {
  kill "$API_PID" "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup INT TERM

wait "$API_PID" "$FRONTEND_PID"
