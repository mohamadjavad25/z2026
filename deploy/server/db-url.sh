#!/usr/bin/env bash
# Prints the app's Postgres URL (used by the deploy script to run migrations through an SSH tunnel).
set -euo pipefail
grep '^POSTGRES_URL=' /etc/frfro/env | cut -d= -f2-
