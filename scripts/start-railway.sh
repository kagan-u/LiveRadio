#!/bin/sh
set -e

echo "=== RadioLive Starting ==="

# Start Icecast in background
mkdir -p /var/log/icecast2 /var/run/icecast2
icecast2 -c /var/log/icecast2 -b 2>/dev/null || true

# Start API in background
cd /app/services/api
DATABASE_URL="${DATABASE_URL:-postgresql://radio:radio_secret@localhost:5432/radiolive}" \
JWT_SECRET="${JWT_SECRET:-change-me}" \
CORS_ORIGIN="${CORS_ORIGIN:-*}" \
npx tsx src/db/migrate.ts 2>/dev/null || true
npx tsx src/index.ts &
API_PID=$!

# Start Web
cd /app/apps/web
PORT=3000 npm start &
WEB_PID=$!

echo "=== RadioLive running ==="
echo "  Web:  http://localhost:3000"
echo "  API:  http://localhost:4000"
echo "  Icecast: http://localhost:8000"

wait $API_PID $WEB_PID
