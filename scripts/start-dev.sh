#!/usr/bin/env bash
# Start the ERP backend in dev mode (auto-restart on file changes).
set -e
cd "$(dirname "$0")/../backend"
if [ ! -d node_modules ]; then
  echo "→ Installing dependencies…"
  npm install
fi
if [ ! -f data/erp.db ]; then
  echo "→ Initializing database…"
  npm run init-db
  echo "→ Seeding demo data…"
  npm run seed
fi
echo "→ Starting server on http://localhost:${PORT:-4000}"
exec npm run dev
