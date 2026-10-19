# استقرار روی سرور خودمان

راهنمای بردن فرفرو از Vercel و Supabase به یک سرور لینوکسی (اوبونتو ۲۲ یا ۲۴). همه‌چیز روی همان سرور است: Node، Postgres، nginx و کارهای زمان‌بندی‌شده. فایل‌های آماده در `deploy/` و `scripts/` هستند.

مسیرهایی که این راهنما فرض می‌کند (اگر عوض شد، در `deploy/*` هم عوضش کن):
- کاربر سیستم: `frfro`
- کد: `/srv/frfro/app`
- تنظیمات: `/srv/frfro/.env`
- بکاپ‌ها: `/srv/frfro/backups`

## ۱. نصب پیش‌نیازها (یک بار)

```bash
sudo timedatectl set-timezone Asia/Tehran
sudo apt update && sudo apt install -y git nginx postgresql postgresql-contrib certbot python3-certbot-nginx
# Node 22 (اگر مخزن nodesource در دسترس نیست، از nvm یا آینهٔ داخلی استفاده کن)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
sudo adduser --system --group --home /srv/frfro frfro
```

اگر `npm ci` از سرور ایرانی کند است یا خطا می‌دهد، آینهٔ داخلی بگذار، مثلاً `npm config set registry https://registry.npmmirror.com`، یا هر آینه‌ای که سرویس‌دهنده‌ات معرفی می‌کند.

## ۲. دیتابیس

```bash
sudo -u postgres createuser frfro
sudo -u postgres createdb -O frfro frfro
sudo -u postgres psql -c "ALTER USER frfro WITH PASSWORD '<یک رمز بلند>'"
```

در `.env`:

```
POSTGRES_URL=postgresql://frfro:<رمز>@127.0.0.1:5432/frfro?sslmode=disable
```

`sslmode=disable` اینجا درست است، چون دیتابیس روی همین سرور است و اتصال از شبکه بیرون نمی‌رود.

### آوردن داده از Supabase (یک بار، شب جابه‌جایی)

۱. در Vercel، یا سایت را در حالت نگهداری بگذار، یا از پنل مدیریت ثبت‌نام را ببند، تا بعد از کپی چیزی نوشته نشود.
۲. کپی بگیر (رشتهٔ اتصال مستقیم Supabase، پورت 5432، از داشبورد Supabase ← Database):

```bash
pg_dump --format=custom --no-owner --no-privileges --schema=public \
  --dbname="postgresql://postgres.<project>:<pass>@<host>:5432/postgres" --file=frfro-supabase.dump
pg_restore --no-owner --no-privileges --dbname="$POSTGRES_URL" frfro-supabase.dump
```

۳. بعد `npm run migrate` (در `deploy.sh` هست) migrationهای جدیدتر را اضافه می‌کند.

### عکس‌ها

عکس‌هایی که به Supabase Storage رفته‌اند، دیگر در دیتابیس نیستند و فقط آدرسشان مانده. یکی از این دو راه:

- **پیشنهادی، مستقل از Supabase:** روی سرور جدید، بعد از کپی دیتابیس و تا وقتی باکت Supabase هنوز باز است:

  ```bash
  node scripts/pull-media-from-storage.mjs --dry-run   # فقط می‌شمارد
  node scripts/pull-media-from-storage.mjs             # عکس‌ها را به دیتابیس برمی‌گرداند
  ```

  بعد `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` را **نگذار**. عکس‌های تازه هم در دیتابیس ذخیره می‌شوند.
- **موقت:** همان دو متغیر Supabase را در `.env` بگذار. عکس‌ها مثل قبل از Supabase خوانده می‌شوند، ولی سرور به اینترنت بین‌الملل وابسته می‌ماند.

بعداً برای بزرگ شدن، یک فضای ذخیرهٔ S3 ایرانی (مثل ابر آروان) جای Supabase Storage می‌آید. این کار جداست و الان لازم نیست.

## ۳. کد و تنظیمات

```bash
sudo -u frfro git clone https://github.com/mohamadjavad25/z2026.git /srv/frfro/app
sudo -u frfro cp /srv/frfro/app/.env.example /srv/frfro/.env
sudo chmod 600 /srv/frfro/.env
```

مقدارهای `/srv/frfro/.env` را از Vercel بیاور. اگر مقداری فاصله دارد، داخل `"..."` بگذارش. حداقل این‌ها:

| متغیر | توضیح |
|---|---|
| `POSTGRES_URL` | بالا |
| `NEXT_PUBLIC_SITE_URL` | `https://frfro.ir` |
| `CRON_SECRET` | یک رشتهٔ تصادفی بلند |
| `FRFRO_ADMIN_PHONES`، `FRFRO_ADMIN_SECRET`، `FRFRO_ADMIN_SETUP_KEY` | **همان مقدارهای Vercel**. با عوض شدن `FRFRO_ADMIN_SECRET`، Authenticator همهٔ مدیرها باطل می‌شود |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`، `FRFRO_VAPID_PRIVATE_KEY`، `FRFRO_VAPID_CONTACT` | همان مقدارهای Vercel، وگرنه اشتراک اعلان کاربرها باطل می‌شود |
| `FRFRO_SMS_PROVIDER`، کلیدهای کاوه‌نگار یا فراز، `FRFRO_OTP_SECRET` | بخش پیامک در `docs/OPERATIONS.md` |
| `FRFRO_OTP_REQUIRED=1` | وقتی پیامک کار کرد |
| `FRFRO_PAYMENT_GATEWAY`، `ZARINPAL_MERCHANT_ID` | وقتی درگاه آماده شد |

`NEXT_PUBLIC_*` در زمان build خوانده می‌شود: بعد از تغییرشان، دوباره `deploy.sh` را اجرا کن.

## ۴. سرویس، nginx و HTTPS

```bash
sudo cp /srv/frfro/app/deploy/frfro.service /etc/systemd/system/frfro.service
sudo systemctl daemon-reload && sudo systemctl enable frfro

sudo cp /srv/frfro/app/deploy/nginx.conf /etc/nginx/sites-available/frfro
sudo ln -s /etc/nginx/sites-available/frfro /etc/nginx/sites-enabled/frfro
sudo mkdir -p /var/www/frfro && sudo cp /srv/frfro/app/deploy/maintenance.html /var/www/frfro/   # صفحهٔ حالت نگهداری
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d frfro.ir -d www.frfro.ir   # بعد از وصل شدن دامنه به IP سرور
```

nginx باید `X-Real-IP` را خودش بگذارد (در `deploy/nginx.conf` هست). محدودیت تلاش ورود، ثبت‌نام و کد پیامکی به‌ازای هر آدرس IP به همین وابسته است. پورت 3000 را در فایروال باز نکن:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

## ۵. هر بار استقرار

```bash
sudo -u frfro /srv/frfro/app/scripts/deploy.sh
```

کد تازهٔ `main` را می‌گیرد، migrationها را اجرا می‌کند، build می‌گیرد، سرویس را دوباره راه می‌اندازد و `/api/health` را چک می‌کند. برای `systemctl restart` بدون رمز، این خط را با `sudo visudo -f /etc/sudoers.d/frfro` اضافه کن:

```
frfro ALL=NOPASSWD: /usr/bin/systemctl restart frfro
```

## ۶. کارهای زمان‌بندی‌شده

جای GitHub Actions، روی خود سرور:

```bash
sudo -u frfro crontab /srv/frfro/app/deploy/crontab
```

بعد از اینکه دیدی روی سرور کار می‌کنند، workflowهای `cron-*.yml` در GitHub را غیرفعال کن (Actions ← هر workflow ← Disable)، یا `APP_URL` را به `https://frfro.ir` بده. اگر هر دو هم‌زمان کار کنند مشکلی پیش نمی‌آید، فقط کار دوبار انجام می‌شود.

## ۷. بکاپ و بازیابی

`scripts/backup-db.sh` هر شب ساعت ۳:۳۰ یک فایل در `/srv/frfro/backups` می‌گذارد و ۱۴ روز آخر را نگه می‌دارد. **هفته‌ای یک بار یک نسخه را از سرور بیرون ببر**، چون بکاپی که روی همان دیسک است، با از دست رفتن سرور از دست می‌رود.

بازیابی، و **یک بار تمرینش روی یک دیتابیس جدا قبل از انتشار**:

```bash
sudo -u postgres createdb -O frfro frfro_restore_test
pg_restore --no-owner --dbname="postgresql://frfro:<رمز>@127.0.0.1:5432/frfro_restore_test" /srv/frfro/backups/<فایل>.dump
psql "postgresql://frfro:<رمز>@127.0.0.1:5432/frfro_restore_test" -c "SELECT count(*) FROM users"
sudo -u postgres dropdb frfro_restore_test
```

## ۸. پایش

- یک سرویس پایش (uptime) را هر ۵ دقیقه روی `https://frfro.ir/api/health` بگذار، با هشدار پیامک یا تلگرام. سرویس‌های ایرانی و خارجی هر دو کار می‌کنند. بهتر است یکی بیرون از ایران هم باشد تا قطعی اینترنت بین‌الملل را هم ببینی.
- لاگ برنامه: `journalctl -u frfro -f`. خطاهای سرور با `"level":"error"` ثبت می‌شوند.
- خطاهای گوشی کاربرها: پنل مدیریت ← سلامت سامانه.

## ۹. جابه‌جایی به سرور دیگر

هر وقت این سرور جوابگو نبود: `docs/SERVER_MOVE.md`. بستهٔ کامل (دیتابیس، env، گواهی) با بررسی تعداد ردیف‌ها، حالت نگهداری چنددقیقه‌ای، و فرستادن سرور قدیم به جدید تا DNS همه جا عوض شود.

## ۱۰. نقشه

نقشه‌ی انتخاب مکان از OpenStreetMap می‌آید (`tile.openstreetmap.org` و `nominatim.openstreetmap.org`). از ایران گاهی کند است و قوانینش استفادهٔ سنگین را مجاز نمی‌داند. جایگزین ایرانی (نشان یا Map.ir) کلید API می‌خواهد. وقتی کلید را گرفتی، تغییرش در `ProfileLocationSettings.jsx` و `LocationButton.jsx` و CSP در `next.config.mjs` است.
