#!/usr/bin/env bash
# Restores a bundle from move-export.sh on the new server (docs/SERVER_MOVE.md) and proves the copy is
# whole: the checksum must match, and every table must hold exactly as many rows as on the old server.
# The target database must be empty (FORCE=1 empties its public schema first). An env file already at
# FRFRO_ENV_FILE is kept (only POSTGRES_URL may differ between servers; the names of other keys whose
# values differ are listed); if there is none, the bundle's is put there. Certificates are put in
# /etc/letsencrypt only if that directory doesn't exist yet. Run as root. Afterwards: scripts/deploy.sh.
# Usage: sudo FRFRO_ENV_FILE=/srv/frfro/.env scripts/move-import.sh <bundle.tar>
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bundle="$(cd "$(dirname "${1:?usage: move-import.sh <bundle.tar>}")" && pwd)/$(basename "$1")"
env_file="${FRFRO_ENV_FILE:-/srv/frfro/.env}"

if [ -f "$bundle.sha256" ]; then
  (cd "$(dirname "$bundle")" && sha256sum -c --quiet "$(basename "$bundle").sha256") || { echo "Checksum does not match: the file was damaged on the way." >&2; exit 1; }
else
  echo "No $bundle.sha256 next to the bundle: copy it too, so damage on the way is caught." >&2
  exit 1
fi

umask 077
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
tar -C "$work" -xf "$bundle"

value() { grep -E "^$1=" "$2" 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '"'"'"'\r'; }
if [ -f "$env_file" ]; then
  differ=""
  for key in $(grep -oE '^[A-Z0-9_]+' "$work/env" | sort -u); do
    case "$key" in POSTGRES_URL|POSTGRES_URL_NON_POOLING|DATABASE_URL|MIGRATE_DATABASE_URL) continue ;; esac
    [ "$(value "$key" "$work/env")" = "$(value "$key" "$env_file")" ] || differ="$differ $key"
  done
  [ -z "$differ" ] || echo "Kept $env_file; these keys differ from the old server's:$differ (FRFRO_ADMIN_SECRET or VAPID keys differing means admins re-enroll and users turn push on again)."
else
  mkdir -p "$(dirname "$env_file")"
  cp "$work/env" "$env_file"
  echo "Put the old server's env at $env_file. Set its POSTGRES_URL to this server's database, then run this again."
  exit 1
fi

url="$(value 'POSTGRES_URL' "$env_file")"
[ -n "$url" ] || url="$(value 'DATABASE_URL' "$env_file")"
[ -n "$url" ] || { echo "POSTGRES_URL is not set in $env_file" >&2; exit 1; }

tables="$(psql "$url" -Atq -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
if [ "$tables" != "0" ]; then
  if [ "${FORCE:-0}" != 1 ]; then
    echo "The target database already has $tables tables. Run with FORCE=1 to empty it first (everything in it is lost)." >&2
    exit 1
  fi
  PGOPTIONS="-c client_min_messages=warning" psql "$url" -q -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
fi

pg_restore --no-owner --no-privileges --exit-on-error --single-transaction --dbname="$url" "$work/db.dump"
"$here/db-counts.sh" "$url" > "$work/counts.after"
if ! diff -q "$work/counts.txt" "$work/counts.after" >/dev/null; then
  echo "The copy does not match the old server (old | new):" >&2
  diff "$work/counts.txt" "$work/counts.after" >&2 || true
  exit 1
fi
echo "database restored: $(wc -l < "$work/counts.after") tables, row counts identical to the old server."

if [ -f "$work/letsencrypt.tgz" ] && [ ! -d /etc/letsencrypt ]; then
  tar -C /etc -xzf "$work/letsencrypt.tgz"
  echo "certificates put in /etc/letsencrypt."
fi
[ -f "$work/commit" ] && echo "the old server ran commit $(cat "$work/commit")."
echo "Next: scripts/deploy.sh (migrations, build, restart), then the checks in docs/SERVER_MOVE.md."
