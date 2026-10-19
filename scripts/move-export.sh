#!/usr/bin/env bash
# Packs everything this server holds into one file for moving to another server (docs/SERVER_MOVE.md):
# the database (pg_dump), its row counts, the env file (same secrets = admins' authenticators and users'
# push subscriptions keep working) and, if present, the Let's Encrypt certificates (no HTTPS gap on the
# new server). The app keeps nothing else on disk. Run as root, with maintenance on, so nothing is
# written while the copy is taken; it refuses if the row counts change during the dump.
# Usage: sudo FRFRO_ENV_FILE=/srv/frfro/.env scripts/move-export.sh [output dir]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
env_file="${FRFRO_ENV_FILE:-/srv/frfro/.env}"
out_dir="${1:-$PWD}"
url="$(grep -E '^(DATABASE_URL|POSTGRES_URL)=' "$env_file" | head -n1 | cut -d= -f2- | tr -d '"'"'"'\r')"
[ -n "$url" ] || { echo "POSTGRES_URL is not set in $env_file" >&2; exit 1; }

umask 077
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

"$here/db-counts.sh" "$url" > "$work/counts.before"
pg_dump --format=custom --no-owner --no-privileges --dbname="$url" --file="$work/db.dump"
"$here/db-counts.sh" "$url" > "$work/counts.txt"
if ! diff -q "$work/counts.before" "$work/counts.txt" >/dev/null; then
  echo "Rows changed while the copy was taken, so it may miss them. Turn maintenance on and run again:" >&2
  diff "$work/counts.before" "$work/counts.txt" >&2 || true
  exit 1
fi
rm "$work/counts.before"

cp "$env_file" "$work/env"
if [ "${WITH_CERTS:-1}" = 1 ] && [ -d /etc/letsencrypt/live ]; then
  tar -C /etc -czf "$work/letsencrypt.tgz" letsencrypt
fi
git -C "$here/.." rev-parse HEAD > "$work/commit" 2>/dev/null || true

mkdir -p "$out_dir"
bundle="$out_dir/frfro-move-$(date +%Y%m%d-%H%M).tar"
tar -C "$work" -cf "$bundle" .
(cd "$out_dir" && sha256sum "$(basename "$bundle")" > "$(basename "$bundle").sha256")
echo "bundle: $bundle ($(du -h "$bundle" | cut -f1)), $(wc -l < "$work/counts.txt") tables, $(grep -E '^users\|' "$work/counts.txt" | cut -d'|' -f2) users"
echo "It holds every secret: copy it only straight to the new server (scp), and delete it after the move."
