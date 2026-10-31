#!/usr/bin/env bash
# Opens one backup on the owner's PC for analysis: decrypts it with the backup password and restores it into a
# local Docker Postgres named frfro-analysis (port 5440, password "analysis"). Real users' data: never expose it.
# Usage: restore-local.sh [backup file]   (default: the newest in ~/frfro-backups)
set -euo pipefail
DEST="${FRFRO_BACKUP_DIR:-$HOME/frfro-backups}"
KEY="${BACKUP_KEY_FILE:-$DEST/backup.key}"
file="${1:-$(ls "$DEST"/frfro-*.dump.gpg | sort | tail -n1)}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$KEY" --decrypt --output "$work/db.dump" "$file"
if ! docker ps --format '{{.Names}}' | grep -qx frfro-analysis; then
  docker rm -f frfro-analysis > /dev/null 2>&1 || true
  docker run -d --name frfro-analysis -p 127.0.0.1:5440:5432 -e POSTGRES_PASSWORD=analysis postgres:16 > /dev/null
  until docker exec frfro-analysis pg_isready -U postgres > /dev/null 2>&1; do sleep 1; done
fi
docker exec frfro-analysis dropdb -U postgres --if-exists frfro
docker exec frfro-analysis createdb -U postgres frfro
# through stdin, so Git Bash never rewrites a container path into a Windows one
docker exec -i frfro-analysis pg_restore -U postgres --no-owner --no-acl -d frfro < "$work/db.dump"
echo "restored $(basename "$file") -> postgres://postgres:analysis@127.0.0.1:5440/frfro"
