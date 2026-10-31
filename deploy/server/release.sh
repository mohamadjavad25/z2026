#!/usr/bin/env bash
# Runs as root via sudo from the deploy user. Usage: release.sh /tmp/frfro-release.tgz
# Unpacks a release, switches the "current" link, restarts the app and checks /api/health.
# If the new release is not healthy within ~40s it goes back to the previous one.
set -euo pipefail
ARCHIVE="${1:?release archive path}"
APP_DIR=/opt/frfro
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$APP_DIR/releases/$STAMP"
PREVIOUS="$(readlink -f "$APP_DIR/current" 2>/dev/null || true)"

mkdir -p "$DEST"
tar -xzf "$ARCHIVE" -C "$DEST" --no-same-owner
chown -R frfro:frfro "$DEST"
chmod +x "$DEST/bin/node"
rm -f "$ARCHIVE"

ln -sfn "$DEST" "$APP_DIR/current"
systemctl restart frfro

healthy=0
for _ in $(seq 1 20); do
  sleep 2
  if curl -fsS -o /dev/null http://127.0.0.1:3000/api/health; then healthy=1; break; fi
done

if [ "$healthy" -ne 1 ]; then
  echo "New release is NOT healthy." >&2
  journalctl -u frfro -n 30 --no-pager >&2 || true
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    ln -sfn "$PREVIOUS" "$APP_DIR/current"
    systemctl restart frfro
    echo "Rolled back to $PREVIOUS" >&2
  fi
  exit 1
fi

# keep the 4 newest releases
ls -1dt "$APP_DIR"/releases/*/ | tail -n +5 | xargs -r rm -rf
echo "Release $STAMP is live."
