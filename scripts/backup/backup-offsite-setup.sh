#!/usr/bin/env bash
# One-time setup on the main server, run as root by the owner: asks for the Arvan bucket and its two keys
# (typed here, never shown), saves them in /etc/frfro/backup-s3.env and checks them with a small test file.
# Run it again to change the keys.
set -euo pipefail
umask 077
S3_ENV="${BACKUP_S3_ENV:-/etc/frfro/backup-s3.env}"

echo "تنظیم فضای ابری برای بکاپ فرفرو"
read -r -p "نشانی فضا (اینتر = s3.ir-thr-at1.arvanstorage.ir): " endpoint
endpoint="${endpoint:-s3.ir-thr-at1.arvanstorage.ir}"
case "$endpoint" in http*) ;; *) endpoint="https://$endpoint" ;; esac
read -r -p "اسم سطل (bucket): " bucket
read -r -p "کلید دسترسی (Access Key): " access
read -r -s -p "کلید مخفی (Secret Key، نوشته‌ها دیده نمی‌شن): " secret
echo
region="${S3_REGION:-ir-thr-at1}"
[ -n "$bucket" ] && [ -n "$access" ] && [ -n "$secret" ] || { echo "یکی از جواب‌ها خالی بود. دوباره اجرا کن."; exit 1; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
printf 'user = "%s:%s"\n' "$access" "$secret" > "$work/auth"
echo "frfro backup check $(date -Is)" > "$work/check.txt"
url="${endpoint%/}/$bucket/setup-check.txt"
sig="aws:amz:$region:s3"
if curl -sS --fail-with-body --max-time 60 --aws-sigv4 "$sig" -K "$work/auth" -T "$work/check.txt" "$url" > "$work/out" &&
   curl -sS --fail-with-body --max-time 60 --aws-sigv4 "$sig" -K "$work/auth" "$url" | cmp -s - "$work/check.txt" &&
   curl -sS --fail-with-body --max-time 60 --aws-sigv4 "$sig" -K "$work/auth" -X DELETE "$url" > /dev/null; then
  {
    echo "S3_ENDPOINT='$endpoint'"
    echo "S3_REGION='$region'"
    echo "S3_BUCKET='$bucket'"
    echo "S3_ACCESS_KEY='$access'"
    echo "S3_SECRET_KEY='$secret'"
  } > "$S3_ENV"
  chmod 600 "$S3_ENV"
  echo "درسته. از امشب بکاپ به فضای ابری هم می‌ره."
else
  echo "فضای ابری جواب نداد. اسم سطل و کلیدها رو چک کن و دوباره اجرا کن. چیزی ذخیره نشد."
  head -c 400 "$work/out" 2>/dev/null || true
  exit 1
fi
