#!/usr/bin/env bash
# Prints "table|rows" for every table in the public schema, sorted by name. Used by the server move
# (docs/SERVER_MOVE.md) to prove the copy holds exactly what the old server had.
# Usage: db-counts.sh <postgres url>
set -euo pipefail
url="${1:?usage: db-counts.sh <postgres url>}"
psql "$url" -Atq -v ON_ERROR_STOP=1 -c "
  SELECT table_name || '|' || (xpath('/row/c/text()',
           query_to_xml(format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')))[1]::text
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name"
