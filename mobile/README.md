# اپلیکیشن فرفرو (اندروید و آیفون)

این پوشه یک پوستهٔ خالی است که سایت `https://frfro.ir` را تمام‌صفحه و مثل یک اپلیکیشن نشان می‌دهد (با [Capacitor](https://capacitorjs.com)).
هر تغییری که روی سایت منتشر شود، بدون آپدیت اپ، در اپ هم دیده می‌شود. اپ فقط وقتی دوباره ساخته و منتشر می‌شود که خود پوسته (آیکون، اسم، مجوزها، افزونه‌ها) عوض شود.

| چیز | مقدار |
|---|---|
| شناسهٔ اپ (Android package / iOS bundle id) | `ir.frfro.app` |
| اسم روی گوشی | فرفرو |
| آدرسی که باز می‌شود | `https://frfro.ir` (در `capacitor.config.json`) |
| بدون اینترنت | صفحهٔ `www/offline.html` با دکمهٔ «تلاش دوباره» |
| User-Agent | آخرش `frfro-app` اضافه می‌شود؛ سایت هم کلاس `native-app` را روی `<html>` می‌گذارد |

## چه کارهایی الان انجام می‌شود
- صفحهٔ شروع (splash) و آیکون با لوگوی فرفرو، نوار وضعیت تیره.
- دکمهٔ «برگشت» گوشی اندروید: اول برگهٔ باز را می‌بندد و در سایت عقب می‌رود (همان منطق `app/shared/lib/backStack.js`)، بعد از اپ خارج می‌شود.
- لینک‌های بیرون از frfro.ir (واتس‌اپ، اینستاگرام، تلفن، نقشه) در برنامهٔ خودشان باز می‌شوند.
- دوربین (اسکن QR و عکس پست)، انتخاب عکس از گالری و موقعیت مکانی اجازه گرفته می‌شوند.
- لینک‌های `https://frfro.ir/...` در اندروید می‌توانند مستقیم اپ را باز کنند (بخش «لینک‌ها» پایین).
- فقط حالت عمودی.

## ساخت اندروید (بدون نیاز به کامپیوتر خاص)
هر بار که چیزی در پوشهٔ `mobile/` عوض شود، GitHub Actions خودش اپ را می‌سازد (workflow «Android app»؛ دستی هم با **Run workflow** اجرا می‌شود).
از صفحهٔ همان اجرا، پایین در بخش **Artifacts**:
- `frfro-android-debug`: فایل APK برای نصب آزمایشی روی گوشی.
- `frfro-android-release`: APK امضاشده (کافه‌بازار، مایکت، دانلود مستقیم) و AAB (گوگل‌پلی). فقط وقتی ساخته می‌شود که کلید امضا تنظیم شده باشد.

### کلید امضا (یک بار، و هیچ‌وقت گمش نکن)
اگر این کلید گم شود، دیگر نمی‌شود آپدیت اپ را در فروشگاه‌ها منتشر کرد.
```bash
keytool -genkeypair -v -keystore frfro.keystore -alias frfro -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 frfro.keystore   # خروجی را کپی کن
```
در GitHub → Settings → Secrets and variables → Actions این‌ها را بساز:
`FRFRO_ANDROID_KEYSTORE_BASE64` (خروجی base64)، `FRFRO_ANDROID_KEYSTORE_PASSWORD`، `FRFRO_ANDROID_KEY_ALIAS` (`frfro`)، `FRFRO_ANDROID_KEY_PASSWORD`.
فایل `frfro.keystore` را جای امن نگه دار و هرگز در مخزن نگذار.

برای هر نسخهٔ جدید فروشگاه، `versionCode` (یکی بیشتر) و `versionName` را در `android/app/build.gradle` بالا ببر.

### ساخت روی کامپیوتر خودت
Node 22، JDK 21 و Android Studio لازم است:
```bash
cd mobile
npm install
npx cap sync
npx cap open android   # در Android Studio: Run
```

## آیفون
ساخت iOS فقط روی مک با Xcode ممکن است و انتشار در App Store حساب Apple Developer (سالانه ۹۹ دلار) می‌خواهد:
```bash
cd mobile
npm install
npx cap sync ios
npx cap open ios       # در Xcode: Signing & Capabilities → Team را انتخاب کن، بعد Run یا Archive
```
افزونه‌ها با Swift Package Manager نصب می‌شوند؛ CocoaPods لازم نیست.
نکته: اپل اپ‌هایی را که فقط یک سایت را نشان می‌دهند گاهی رد می‌کند (قانون 4.2). قابلیت‌های بومی مثل اعلان (پایین) شانس تأیید را بالا می‌برند. راه دیگر برای کاربران ایرانی، فروشگاه‌های سیب‌اپ و انار‌دونی است.

## عوض کردن آیکون و صفحهٔ شروع
تصویرها در `assets/` هستند (`icon-only.png`، `icon-foreground.png`، `icon-background.png`، `splash.png`، `splash-dark.png`). بعد از عوض کردن:
```bash
npm run assets && npx cap sync
```

## لینک‌ها (باز شدن frfro.ir در اپ)
اندروید از قبل آماده است؛ فقط باید سایت تأیید کند که این اپ مال خودش است. بعد از ساختن کلید امضا، اثر SHA-256 آن را بگیر:
```bash
keytool -list -v -keystore frfro.keystore -alias frfro | grep SHA256
```
و فایل `public/.well-known/assetlinks.json` را در سایت با همین مقدار بساز (اگر در گوگل‌پلی «Play App Signing» روشن است، اثر کلید گوگل را هم اضافه کن):
```json
[{ "relation": ["delegate_permission/common.handle_all_urls"],
   "target": { "namespace": "android_app", "package_name": "ir.frfro.app",
               "sha256_cert_fingerprints": ["AA:BB:..."] } }]
```
برای آیفون (Universal Links) شناسهٔ تیم اپل لازم است و بعد از گرفتن حساب اپل اضافه می‌شود.

## قدم بعدی: اعلان (Push)
اعلان فعلی سایت (Web Push) داخل اپ کار نمی‌کند، چون WebView اندروید و آیفون از آن پشتیبانی نمی‌کنند. برای اعلان در اپ باید اعلان بومی اضافه شود (در `docs/ROADMAP.md` ثبت شده).
