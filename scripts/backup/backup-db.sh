#!/usr/bin/env bash
# Nightly database backup on the main server. Installed as /opt/frfro/bin/backup-db.sh and run as root from
# /etc/cron.d/frfro (scripts/backup/frfro.cron) at 03:30 Tehran time. How it fits together: docs/DEPLOY_SERVER.md «بکاپ».
#   1. pg_dump into /var/backups/frfro (root only); the last 14 days are kept.
#   2. An encrypted copy (gpg, password in /etc/frfro/backup.key) into /var/backups/frfro-offsite, also 14 days.
#      The owner's PC pulls these as the deploy user (scripts/backup/pull-backups.sh) and keeps all of them.
#   3. When /etc/frfro/backup-s3.env exists, the encrypted copy goes to the Arvan bucket too:
#      daily/ keeps the last 7, weekly/ (Friday nights) the last 4.
# A failure pushes the «فرفرو مدیر» app through /api/cron/backup-alert. Every path can be overridden for a test run.
set -euo pipefail
umask 077

DIR="${BACKUP_DIR:-/var/backups/frfro}"
OFFSITE="${BACKUP_OFFSITE_DIR:-/var/backups/frfro-offsite}"
KEY="${BACKUP_KEY_FILE:-/etc/frfro/backup.key}"
S3_ENV="${BACKUP_S3_ENV:-/etc/frfro/backup-s3.env}"
ENV_FILE="${FRFRO_ENV_FILE:-/etc/frfro/env}"
DB="${BACKUP_DB:-frfro}"
KEEP_DAYS="${KEEP_DAYS:-14}"
NAME="frfro-$(date +%Y%m%d-%H%M).dump"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# alert <made|offsite> <log line>: tells the admins, never fails the script by itself
alert() {
  echo "$(date -Is) backup: $2" >&2
  local secret
  secret="$(grep -E '^CRON_SECRET=' "$ENV_FILE" 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '"'"'"'\r')" || true
  [ -n "$secret" ] || return 0
  curl -sS -o /dev/null --max-time 30 -X POST -H "Authorization: Bearer $secret" -H "Content-Type: application/json" \
    -d "{\"what\":\"$1\"}" "http://127.0.0.1:${PORT:-3000}/api/cron/backup-alert" || true
}

mkdir -p "$DIR" "$OFFSITE"
chmod 700 "$DIR"
chmod 755 "$OFFSITE"

# 1. the dump, checked by reading its table of contents back
if ! runuser -u postgres -- pg_dump -Fc "$DB" > "$DIR/$NAME.part" || ! pg_restore --list "$DIR/$NAME.part" > /dev/null; then
  rm -f "$DIR/$NAME.part"
  alert made "pg_dump failed"
  exit 1
fi
mv "$DIR/$NAME.part" "$DIR/$NAME"
find "$DIR" -name 'frfro-*.dump' -mtime +"$KEEP_DAYS" -delete

# 2. the encrypted copy
if [ ! -s "$KEY" ]; then
  alert offsite "no backup password in $KEY"
  exit 1
fi
if ! GNUPGHOME="$WORK" gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$KEY" \
     --symmetric --cipher-algo AES256 --output "$OFFSITE/$NAME.gpg.part" "$DIR/$NAME"; then
  rm -f "$OFFSITE/$NAME.gpg.part"
  alert offsite "gpg failed"
  exit 1
fi
chmod 644 "$OFFSITE/$NAME.gpg.part"
mv "$OFFSITE/$NAME.gpg.part" "$OFFSITE/$NAME.gpg"
find "$OFFSITE" -name 'frfro-*.dump.gpg' -mtime +"$KEEP_DAYS" -delete

# 3. Arvan (any S3-compatible storage); skipped until backup-offsite-setup.sh has written the keys
if [ ! -f "$S3_ENV" ]; then
  echo "backup written: $DIR/$NAME (no offsite storage set up yet)"
  exit 0
fi
# shellcheck disable=SC1090
. "$S3_ENV"
printf 'user = "%s:%s"\n' "$S3_ACCESS_KEY" "$S3_SECRET_KEY" > "$WORK/auth"

# s3 <method> <path after the bucket> [file to upload]
s3() {
  curl -sS --fail-with-body --max-time 300 --aws-sigv4 "aws:amz:${S3_REGION}:s3" -K "$WORK/auth" \
    -X "$1" ${3:+-T "$3"} "${S3_ENDPOINT%/}/$S3_BUCKET/$2"
}

# keep <prefix> <count>: deletes all but the newest <count> backups under the prefix (names sort by date)
keep() {
  local keys
  keys="$(s3 GET "?list-type=2&prefix=$1" | grep -o '<Key>[^<]*</Key>' | sed 's/<[^>]*>//g' | grep -E '/frfro-[0-9-]+\.dump\.gpg$' | sort)" || return 1
  [ -n "$keys" ] || return 0
  echo "$keys" | head -n -"$2" | while read -r k; do s3 DELETE "$k" > /dev/null; done
}

sent=1
s3 PUT "daily/$NAME.gpg" "$OFFSITE/$NAME.gpg" > /dev/null && keep daily/ 7 || sent=0
if [ "$sent" = 1 ] && [ "$(date +%u)" = 5 ]; then
  s3 PUT "weekly/$NAME.gpg" "$OFFSITE/$NAME.gpg" > /dev/null && keep weekly/ 4 || sent=0
fi
if [ "$sent" != 1 ]; then
  alert offsite "upload to $S3_ENDPOINT failed"
  exit 1
fi
echo "backup written and sent: $NAME"
