#!/usr/bin/env bash
# Calls one /api/cron/<job> endpoint on this server with the shared CRON_SECRET (see scripts/backup/frfro.cron).
# Talks to the app directly on 127.0.0.1, so it works even while the public domain or TLS has a problem.
set -euo pipefail
job="${1:?usage: cron-call.sh <expire-bookings|send-reminders|billing|migrate-media>}"
env_file="${FRFRO_ENV_FILE:-/srv/frfro/.env}"
secret="$(grep -E '^CRON_SECRET=' "$env_file" | head -n1 | cut -d= -f2- | tr -d '"'"'"'\r')"
[ -n "$secret" ] || { echo "CRON_SECRET is not set in $env_file" >&2; exit 1; }
status=$(curl -sS -o /tmp/frfro-cron-$job.json -w "%{http_code}" --max-time 120 \
  -X POST -H "Authorization: Bearer $secret" "http://127.0.0.1:${PORT:-3000}/api/cron/$job")
if [ "$status" != "200" ]; then
  echo "$(date -Is) cron $job -> HTTP $status: $(head -c 300 /tmp/frfro-cron-$job.json)" >&2
  exit 1
fi
