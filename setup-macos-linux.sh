#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Saarthi local setup"
echo "==================="

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Install Node.js 20.19+ from https://nodejs.org/"
  exit 1
fi

if command -v pnpm >/dev/null 2>&1; then
  PNPM=(pnpm)
elif command -v corepack >/dev/null 2>&1; then
  echo "pnpm was not found. Using Node.js Corepack."
  PNPM=(corepack pnpm)
else
  echo "Neither pnpm nor Node.js Corepack was found."
  echo "Install or reinstall Node.js LTS from https://nodejs.org/"
  exit 1
fi

read -r -p "Enter your PostgreSQL DATABASE_URL: " DATABASE_URL
if [[ -z "$DATABASE_URL" ]]; then
  echo "DATABASE_URL is required."
  exit 1
fi

export DATABASE_URL

echo "Installing project dependencies..."
"${PNPM[@]}" install

echo "Creating or updating database tables..."
"${PNPM[@]}" --filter @workspace/db run push

echo "Starting API on http://localhost:5000..."
(export PORT=5000; "${PNPM[@]}" --filter @workspace/api-server run dev) &
API_PID=$!

cleanup() {
  kill "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting web app on http://localhost:5173..."
export PORT=5173
export BASE_PATH=/
echo "Open http://localhost:5173 in your browser."
"${PNPM[@]}" --filter @workspace/finance-advisor run dev
