#!/usr/bin/env bash
# Nightly database backup (see deploy/crontab): a compressed pg_dump in $BACKUP_DIR, the last $KEEP_DAYS kept.
# Copy these files OFF this server too (another server, or your own computer): a backup on the same disk
# does not survive losing the server. Restore: docs/DEPLOY_SERVER.md, «بکاپ و بازیابی».
set -euo pipefail
env_file="${FRFRO_ENV_FILE:-/srv/frfro/.env}"
backup_dir="${BACKUP_DIR:-/srv/frfro/backups}"
keep_days="${KEEP_DAYS:-14}"
url="$(grep -E '^(DATABASE_URL|POSTGRES_URL)=' "$env_file" | head -n1 | cut -d= -f2- | tr -d '"'"'"'\r')"
[ -n "$url" ] || { echo "POSTGRES_URL is not set in $env_file" >&2; exit 1; }
mkdir -p "$backup_dir"
file="$backup_dir/frfro-$(date +%Y%m%d-%H%M).dump"
pg_dump --format=custom --no-owner --dbname="$url" --file="$file.part"
mv "$file.part" "$file"
find "$backup_dir" -name 'frfro-*.dump' -mtime +"$keep_days" -delete
echo "backup written: $file ($(du -h "$file" | cut -f1))"
