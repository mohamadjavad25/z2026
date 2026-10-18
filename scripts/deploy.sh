#!/usr/bin/env bash
# Puts the latest main on this server: fetch, install, migrate the database, build, restart.
# Run as the frfro user from /srv/frfro/app. Stops at the first failing step, and the running site
# keeps serving the previous build until the restart at the very end.
set -euo pipefail
cd "$(dirname "$0")/.."
env_file="${FRFRO_ENV_FILE:-/srv/frfro/.env}"
set -a; . "$env_file"; set +a

branch="${1:-main}"
git fetch origin "$branch"
git checkout -q "$branch"
git reset -q --hard "origin/$branch"

npm ci --no-audit --no-fund
# Migrations before the new code starts: every schema change the code needs is in migrations/.
npm run migrate
npm run build

sudo systemctl restart frfro
sleep 3
curl -fsS "http://127.0.0.1:${PORT:-3000}/api/health" && echo && echo "deployed $(git rev-parse --short HEAD)"
