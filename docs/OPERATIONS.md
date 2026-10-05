# عملیات و پایش

## سلامت
- `GET /api/health`: زنده بودن + یک کوئری واقعی به Postgres؛ `version` = ۷ کاراکتر اول SHA کامیت (روی Vercel). به یک مانیتور آپ‌تایم وصلش کن.

## خطاها
- سرور: همهٔ routeها با `withErrorHandling` خطا را به‌صورت JSON ساختاریافته (`level`، `method`، `url`، `stack`) در stdout می‌نویسند؛ Vercel آن‌ها را جمع می‌کند.
- مرورگر: `window.onerror`، `unhandledrejection` و error boundaryها به `POST /api/client-errors` گزارش می‌شوند و در همان لاگ سرور (`"client error"`) می‌آیند. محدودیت: ۶۰ در دقیقه، اندازهٔ محدود.
- پیشنهاد: روی لاگ، هشدار برای `level=error` بگذار (Vercel Log Drains یا هر سرویس لاگ).

## کارهای زمان‌بندی‌شده (GitHub Actions)
نیاز: secretهای `APP_URL` و `CRON_SECRET` در مخزن (و همان `CRON_SECRET` در محیط اپ).
- `cron-expire-bookings.yml` (۵ دقیقه): درخواست‌های بی‌پاسخ بعد از ۱ ساعت منقضی می‌شوند.
- `cron-booking-reminders.yml` (۱۰ دقیقه): یادآوری مشتری ۲۴ ساعت و ۲ ساعت قبل از رزرو تأییدشده (نیاز به کلیدهای VAPID برای ارسال واقعی).

## متغیرهای محیطی مهم
`POSTGRES_URL`، `CRON_SECRET`، `NEXT_PUBLIC_VAPID_PUBLIC_KEY`، `ZIBABAN_VAPID_PRIVATE_KEY`، `ZIBABAN_VAPID_CONTACT`، (اختیاری) `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.

## بکاپ و بازیابی
- پایگاه داده: بکاپ روزانهٔ ارائه‌دهندهٔ Postgres را فعال کن و **یک‌بار بازیابی را روی نمونهٔ جدا تمرین کن** (هنوز انجام نشده).
- مایگریشن‌ها همه `-- Down Migration` دارند؛ قبل از مایگریشن مخرب snapshot بگیر.

## آنچه هنوز نیست (تصمیم‌شده برای بعد)
OTP/پیامک و سیستم مدیریت (ادمین)، سرویس خطای شخص ثالث (Sentry)، مجوزها و متن حقوقی نهایی.
