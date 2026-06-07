#!/usr/bin/env bash
# ============================================================================
# College ERP — DB backup script
# Performs a safe online backup via SQLite's .backup command and prunes old
# copies. Designed to be run from cron, e.g.:
#   0 2 * * * /opt/erp/scripts/backup.sh
# ============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/erp}"
KEEP_DAYS="${KEEP_DAYS:-30}"
DB_PATH="${DB_PATH:-/opt/erp/backend/data/erp.db}"
TS="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_DIR/erp-$TS.db"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 not installed. Install with: apt install -y sqlite3" >&2
  exit 1
fi

if [ ! -f "$DB_PATH" ]; then
  echo "DB not found at $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
echo "→ Backing up $DB_PATH → $DEST"
sqlite3 "$DB_PATH" ".backup '$DEST'"

# Compress (best-effort)
if command -v gzip >/dev/null 2>&1; then
  gzip -f "$DEST"
  DEST="$DEST.gz"
fi

# Prune old backups
find "$BACKUP_DIR" -name 'erp-*.db*' -mtime +$KEEP_DAYS -delete 2>/dev/null || true
echo "✓ Done. Keeping last $KEEP_DAYS days."
