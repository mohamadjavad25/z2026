#!/usr/bin/env bash
# Calls one of the app's cron endpoints on this machine: cron-call.sh expire-bookings
set -euo pipefail
NAME="${1:?endpoint name}"
SECRET="$(grep '^CRON_SECRET=' /etc/frfro/env | cut -d= -f2-)"
curl -sS -m 55 -o /dev/null -w "$NAME HTTP %{http_code}\n" -X POST \
  -H "Authorization: Bearer $SECRET" "http://127.0.0.1:3000/api/cron/$NAME"
