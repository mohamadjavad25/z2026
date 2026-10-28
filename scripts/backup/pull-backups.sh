#!/usr/bin/env bash
# Runs on the owner's PC (Git Bash, from a daily Windows scheduled task, see install-pull-task.ps1):
# downloads every encrypted backup the main server has that this PC does not, and never deletes any.
# The server keeps 14 days, so a PC that stays off longer misses the oldest nights.
set -euo pipefail
HOST="${FRFRO_BACKUP_HOST:-deploy@87.107.130.167}"
SRC="${FRFRO_BACKUP_SRC:-/var/backups/frfro-offsite}"
DEST="${FRFRO_BACKUP_DIR:-$HOME/frfro-backups}"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=20)
mkdir -p "$DEST"
log() { echo "$(date '+%Y-%m-%d %H:%M') $*" >> "$DEST/pull.log"; }

if ! list="$(ssh "${SSH_OPTS[@]}" "$HOST" "ls $SRC" 2>&1)"; then
  log "server not reachable: $list"
  exit 1
fi
got=0
while read -r f; do
  [ -s "$DEST/$f" ] && continue
  if scp -q "${SSH_OPTS[@]}" "$HOST:$SRC/$f" "$DEST/$f.part" < /dev/null; then
    mv "$DEST/$f.part" "$DEST/$f"
    got=$((got + 1))
  else
    rm -f "$DEST/$f.part"
    log "failed: $f"
  fi
done < <(echo "$list" | grep -E '^frfro-[0-9-]+\.dump\.gpg$')
log "ok, $got new, $(ls "$DEST"/frfro-*.dump.gpg 2>/dev/null | wc -l) in total"
