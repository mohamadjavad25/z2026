#!/usr/bin/env bash
# Sends the release archive to the server. The road to the server can drop mid-file (2026-11-06: 250 KB of 62 MB
# arrived from GitHub), so it tries again, and only counts an upload whose size on the server matches.
#
#   bash deploy/upload-release.sh <archive> <user@host>
set -euo pipefail

ARCHIVE="${1:?archive path}"
TARGET="${2:?user@host}"
REMOTE=/tmp/frfro-release.tgz
TRIES="${UPLOAD_TRIES:-4}"
WAIT="${UPLOAD_RETRY_WAIT:-15}"
OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4)
WANT="$(wc -c < "$ARCHIVE" | tr -d ' ')"

for try in $(seq 1 "$TRIES"); do
  if scp "${OPTS[@]}" "$ARCHIVE" "$TARGET:$REMOTE"; then
    GOT="$(ssh "${OPTS[@]}" "$TARGET" "stat -c %s $REMOTE" || echo 0)"
    if [ "$GOT" = "$WANT" ]; then
      echo "    uploaded $WANT bytes (try $try of $TRIES)"
      exit 0
    fi
    echo "    only $GOT of $WANT bytes arrived"
  fi
  echo "    upload try $try of $TRIES failed"
  if [ "$try" -lt "$TRIES" ]; then sleep "$WAIT"; fi
done

echo "Upload failed after $TRIES tries; nothing on the server changed." >&2
exit 1
