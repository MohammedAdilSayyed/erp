#!/usr/bin/env bash
# Restore the most recent (or a specified) DB backup. Stops the running service
# if it's managed by systemd, swaps the DB, then restarts.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/erp}"
DB_PATH="${DB_PATH:-/opt/erp/backend/data/erp.db}"
SERVICE_NAME="${SERVICE_NAME:-college-erp}"

usage() { echo "Usage: $0 [path-to-backup-file]"; }

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then usage; exit 0; fi

if [ -n "${1:-}" ]; then
  SRC="$1"
else
  SRC="$(ls -1t "$BACKUP_DIR"/erp-*.db* 2>/dev/null | head -n 1 || true)"
  if [ -z "$SRC" ]; then
    echo "No backups found in $BACKUP_DIR" >&2; exit 1
  fi
fi

echo "→ Restoring $SRC → $DB_PATH"

if [ "${SRC##*.}" = "gz" ]; then
  TMP="${SRC%.gz}"
  gunzip -c "$SRC" > "$TMP"
  SRC="$TMP"
fi

if systemctl list-unit-files | grep -q "^${SERVICE_NAME}.service"; then
  sudo systemctl stop "$SERVICE_NAME" || true
fi

sudo cp "$SRC" "$DB_PATH"
sudo chown erp:erp "$DB_PATH" 2>/dev/null || true

if systemctl list-unit-files | grep -q "^${SERVICE_NAME}.service"; then
  sudo systemctl start "$SERVICE_NAME"
fi
echo "✓ Restore complete."
