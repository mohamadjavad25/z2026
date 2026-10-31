# استقرار روی سرور ایرانی

این پوشه frfro را روی یک VPS اوبونتو ۲۴.۰۴ راه می‌اندازد، بدون اینکه به Vercel دست بزند. هیچ‌چیز خودکار نیست؛ هر دیپلوی را شما شروع می‌کنید.

## طرح کلی
- روی سرور: Postgres، Nginx، یک سرویس systemd به نام `frfro`، کرون‌ها (جای GitHub Actions) و بکاپ روزانه.
- ساخت (build) روی کامپیوتر شما یا GitHub Actions انجام می‌شود و خروجی با SSH به سرور می‌رود. فایل اجرایی Node هم همراه آن می‌رود، پس سرور به GitHub، npm و nodejs.org نیازی ندارد.
- عکس‌ها مثل قبل در دیتابیس می‌مانند (`SUPABASE_URL` تنظیم نمی‌شود).
- دیتابیس خالی است و مایگریشن‌ها اجرا می‌شوند. داده‌ای از Supabase منتقل نمی‌شود.

## مرحله ۱: یک‌بار آماده‌سازی سرور
۱. روی کامپیوتر خودتان یک کلید SSH مخصوص دیپلوی بسازید: `ssh-keygen -t ed25519 -f frfro-deploy -N ""`
۲. به سرور وصل شوید (`ssh root@IP`)، پوشه `deploy/` را روی آن کپی کنید (مثلاً `scp -r deploy root@IP:/root/`) و اجرا کنید:

```
cd /root/deploy
DEPLOY_PUBKEY="$(cat frfro-deploy.pub)" bash setup-server.sh
```
(متن کلید عمومی را دقیق جایگزین کنید.) برای دامنه: `DOMAIN=new.frfro.ir CERTBOT_EMAIL=you@example.com` هم بدهید، بعد از اینکه DNS دامنه به IP سرور اشاره کرد.

۳. در `/etc/frfro/env` مقدار `FRFRO_ADMIN_PHONES` (شماره مدیر) را بگذارید. کلیدهای پیامک را هم وقتی آماده شد.

## مرحله ۲: دیپلوی
از کامپیوتر خودتان (Node 22 لازم است):
```
DEPLOY_HOST=IP-SERVER bash deploy/deploy.sh    # کلید frfro-deploy را با ssh-add یا ~/.ssh/config معرفی کنید
```
یا از GitHub: در Settings → Secrets دو مقدار `DEPLOY_HOST` و `DEPLOY_SSH_KEY` (کلید خصوصی) را بگذارید و در تب Actions «Deploy to Iranian server» را Run کنید.

اگر نسخه جدید سالم بالا نیاید (`/api/health`)، خودکار به نسخه قبل برمی‌گردد.

## بعد از اولین دیپلوی
- آدرس سایت را باز کنید و `/api/health` را ببینید.
- مدیر: در `/admin` «راه‌اندازی اولیه» را بزنید (کلید راه‌اندازی در `/etc/frfro/env` است: `FRFRO_ADMIN_SETUP_KEY`).
- بستن ورود با رمز: دستورهای آخر خروجی `setup-server.sh`.

## کارهای روزمره
- لاگ برنامه: `journalctl -u frfro -f`، لاگ کرون: `/var/log/frfro-cron.log`
- بکاپ‌ها: `/var/backups/frfro/` (۱۴ روز). حتماً هر چند وقت یک بار یک نسخه را بیرون از سرور هم نگه دارید: `scp deploy@IP:...` (فایل‌ها فقط برای root خوانا هستند؛ برای کپی از `sudo` یا کاربر root استفاده کنید).
- بازیابی: `sudo -u postgres pg_restore -c -d frfro فایل.dump`
- انتقال دامنه `frfro.ir`: بعد از تست، DNS را به IP سرور ببرید و `NEXT_PUBLIC_SITE_URL` در `/etc/frfro/env` و فایل `/etc/frfro/site-url` را عوض کنید، سپس دوباره دیپلوی کنید (آدرس سایت هنگام build داخل کد جاسازی می‌شود). با `certbot --nginx -d frfro.ir` گواهی بگیرید.

## یادداشت‌ها
- اعلان‌های اپ (Web Push) به سرورهای گوگل نیاز دارند؛ اگر سرور به اینترنت بین‌الملل وصل نباشد کار نمی‌کنند.
- کرون‌های GitHub Actions فعلی هنوز به Vercel می‌زنند و دست‌نخورده‌اند.
