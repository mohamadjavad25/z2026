#!/usr/bin/env bash
# Builds frfro, ships it to the server and switches over. Runs on your PC or in GitHub Actions.
#
#   DEPLOY_HOST=87.107.130.167 bash deploy/deploy.sh
#
# Needs: node 22 + npm, ssh/scp access as DEPLOY_USER (key login), and the server prepared with setup-server.sh.
# The server never needs GitHub or npm: the build, and the Node binary it runs on, are shipped from here.
set -euo pipefail

HOST="${DEPLOY_HOST:?set DEPLOY_HOST to the server IP or name}"
USER_="${DEPLOY_USER:-deploy}"
NODE_VERSION="${NODE_VERSION:-22.12.0}"
LOCAL_DB_PORT="${LOCAL_DB_PORT:-15432}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH=(ssh -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=15 "$USER_@$HOST")
cd "$ROOT"

echo "==> Reading public build settings from the server"
NEXT_PUBLIC_VAPID_PUBLIC_KEY="${NEXT_PUBLIC_VAPID_PUBLIC_KEY:-$("${SSH[@]}" cat /etc/frfro/vapid.pub)}"
NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-$("${SSH[@]}" cat /etc/frfro/site-url)}"
export NEXT_PUBLIC_VAPID_PUBLIC_KEY NEXT_PUBLIC_SITE_URL
echo "    site url: $NEXT_PUBLIC_SITE_URL"

echo "==> Build"
[ -d node_modules ] || npm ci
NEXT_OUTPUT=standalone npm run build

echo "==> Assemble release"
DIST="$ROOT/.deploy-dist"
rm -rf "$DIST"; mkdir -p "$DIST/app/.next" "$DIST/app/bin"
cp -a .next/standalone/. "$DIST/app/"
cp -a .next/static "$DIST/app/.next/static"
cp -a public "$DIST/app/public"
# One app copy per CPU core (scripts/start-app.mjs): it takes the server.js name the systemd unit runs.
mv "$DIST/app/server.js" "$DIST/app/next-server.js"
cp scripts/start-app.mjs "$DIST/app/server.js"

CACHE="$ROOT/deploy/.cache"; mkdir -p "$CACHE"
NODE_DIR="node-v$NODE_VERSION-linux-x64"
if [ ! -x "$CACHE/$NODE_DIR/bin/node" ]; then
  echo "    downloading Node $NODE_VERSION for the server"
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/$NODE_DIR.tar.xz" -o "$CACHE/$NODE_DIR.tar.xz"
  expected="$(curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt" | grep " $NODE_DIR.tar.xz\$" | cut -d' ' -f1)"
  actual="$(sha256sum "$CACHE/$NODE_DIR.tar.xz" | cut -d' ' -f1)"
  [ -n "$expected" ] && [ "$expected" = "$actual" ] || { echo "Node checksum mismatch" >&2; rm -f "$CACHE/$NODE_DIR.tar.xz"; exit 1; }
  tar -xJf "$CACHE/$NODE_DIR.tar.xz" -C "$CACHE"
fi
cp "$CACHE/$NODE_DIR/bin/node" "$DIST/app/bin/node"

ARCHIVE="$DIST/frfro-release.tgz"
tar -czf "$ARCHIVE" -C "$DIST/app" .
echo "    $(du -h "$ARCHIVE" | cut -f1) release archive"

echo "==> Upload"
scp -o StrictHostKeyChecking=accept-new "$ARCHIVE" "$USER_@$HOST:/tmp/frfro-release.tgz"

echo "==> Database migrations (through an SSH tunnel to the server's Postgres)"
DB_URL="$("${SSH[@]}" sudo /opt/frfro/bin/db-url.sh)"
LOCAL_URL="${DB_URL/@127.0.0.1:5432\//@127.0.0.1:$LOCAL_DB_PORT/}"
ssh -o StrictHostKeyChecking=accept-new -o ExitOnForwardFailure=yes -N -L "$LOCAL_DB_PORT:127.0.0.1:5432" "$USER_@$HOST" &
TUNNEL=$!
trap 'kill $TUNNEL 2>/dev/null || true' EXIT
for _ in $(seq 1 20); do (exec 3<>"/dev/tcp/127.0.0.1/$LOCAL_DB_PORT") 2>/dev/null && break; sleep 0.5; done
MIGRATE_DATABASE_URL="$LOCAL_URL" npm run migrate
kill $TUNNEL 2>/dev/null || true; trap - EXIT

echo "==> Switch over"
"${SSH[@]}" sudo /opt/frfro/bin/release.sh /tmp/frfro-release.tgz
echo "Done."
