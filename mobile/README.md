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
- «مخاطبین» در صفحهٔ مشتریان سالن و آرتیست: فهرست مخاطبین خود گوشی باز می‌شود (افزونهٔ `ContactPickerPlugin` در `android/app/src/main/java/ir/frfro/app/`). فقط همان یک شماره‌ای که انتخاب شود به سایت می‌رسد، پس مجوز خواندن مخاطبین لازم نیست. از نسخهٔ ۱.۱.۰ به بعد؛ در آیفون هنوز نیست.
- لینک‌های `https://frfro.ir/...` در اندروید می‌توانند مستقیم اپ را باز کنند (بخش «لینک‌ها» پایین).
- فقط حالت عمودی.

## ساخت اندروید (بدون نیاز به کامپیوتر خاص)
هر بار که چیزی در پوشهٔ `mobile/` عوض شود، GitHub Actions خودش اپ را می‌سازد (workflow «Android app»؛ دستی هم با **Run workflow** اجرا می‌شود).
از صفحهٔ همان اجرا، پایین در بخش **Artifacts**:
- `frfro-android-debug`: فایل APK برای نصب آزمایشی روی گوشی.
- `frfro-admin-android-debug`: اپ «فرفرو مدیر» برای نصب آزمایشی (پایین: «اپ مدیر»).
- `frfro-android-release`: APK امضاشده (کافه‌بازار، مایکت، دانلود مستقیم) و AAB (گوگل‌پلی). فقط وقتی ساخته می‌شود که کلید امضا تنظیم شده باشد.

### کلید امضا (هیچ‌وقت گمش نکن)
کلید اصلی فرفرو (`frfro-release.keystore`، alias `frfro`) در ۱۴ اکتبر ۲۰۲۶ ساخته شد و به صاحب محصول داده شد؛ در مخزن نیست و نباید باشد.
اثر SHA-256 آن: `C9:B3:A3:A0:23:BA:ED:E8:6D:D2:D8:7E:BF:22:9A:FB:8D:66:55:A3:B6:99:AD:0A:B3:7B:C0:1C:A6:DC:DE:74` (همان که در `public/.well-known/assetlinks.json` است).
اگر این کلید گم شود، نسخهٔ جدید روی نسخهٔ نصب‌شدهٔ کاربران نصب نمی‌شود و همه باید اپ را پاک کنند و دوباره بگیرند.

برای این‌که GitHub خودش نسخهٔ امضاشده بسازد، در GitHub → Settings → Secrets and variables → Actions این‌ها را بساز:
`FRFRO_ANDROID_KEYSTORE_BASE64` (خروجی `base64 -w0 frfro-release.keystore`)، `FRFRO_ANDROID_KEYSTORE_PASSWORD` و `FRFRO_ANDROID_KEY_PASSWORD` (هر دو همان رمز)، `FRFRO_ANDROID_KEY_ALIAS` (`frfro`).

### انتشار نسخهٔ جدید در سایت
فایل نصبی سایت در `public/download/frfro.apk` است (دکمه‌های صفحهٔ `/download` به آن اشاره می‌کنند).
1. `versionCode` را یکی بالا ببر و `versionName` را در `android/app/build.gradle` عوض کن.
2. نسخهٔ امضاشده را بساز (workflow «Android app» با کلید، یا روی کامپیوتر با `./gradlew assembleUserRelease`).
3. فایل `app-user-release.apk` را جای `public/download/frfro.apk` بگذار و `ANDROID_APP_VERSION` را در `app/features/landing/constants.js` عوض کن.

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

## صفحهٔ معرفی و دانلود
- `frfro.ir/download`: صفحهٔ معرفی فرفرو با دکمهٔ دانلود اندروید و راهنمای آیفون (`app/features/landing/`). این لینک را برای معرفی بفرست.
- روی تبلت و کامپیوتر (صفحهٔ دست‌کم ۶۰۰×۶۰۰) همهٔ صفحه‌های سایت به‌جز پنل ادمین، قوانین و حریم خصوصی همین صفحه را نشان می‌دهند. روی گوشی و داخل اپ، همان صفحه‌های همیشگی.
- لینک «دانلود اپلیکیشن» در صفحهٔ ورود و تنظیمات فقط در مرورگر دیده می‌شود، نه داخل اپ.

## عوض کردن آیکون و صفحهٔ شروع
تصویرها در `assets/` هستند (`icon-only.png`، `icon-foreground.png`، `icon-background.png`، `splash.png`، `splash-dark.png`). بعد از عوض کردن:
```bash
npm run assets && npx cap sync
```

## لینک‌ها (باز شدن frfro.ir در اپ)
اندروید آماده است: `public/.well-known/assetlinks.json` اثر کلید فرفرو را دارد، پس لینک‌های frfro.ir در گوشی‌هایی که اپ دارند مستقیم اپ را باز می‌کنند.
اگر بعداً در گوگل‌پلی «Play App Signing» روشن شد، اثر کلید گوگل را هم به همان فایل اضافه کن.
برای آیفون (Universal Links) شناسهٔ تیم اپل لازم است و بعد از گرفتن حساب اپل اضافه می‌شود.

## اپ مدیر («فرفرو مدیر»)
یک اپ دوم از همین پوسته، فقط برای مدیرها: شناسهٔ `ir.frfro.admin`، اسم «فرفرو مدیر»، آیکن لوگوی فرفرو روی قرمز با چشم‌های قرمز (`public/brand/frfro-admin-icon.png`، انتخاب صاحب محصول ۱۹ اکتبر ۲۰۲۶). مستقیم `https://frfro.ir/admin` را باز می‌کند و ورودش همان سه قفل پنل است (شماره، رمز، کد Authenticator).
- **هیچ‌وقت در کافه‌بازار، مایکت یا گوگل‌پلی منتشر نمی‌شود**؛ فایل APK فقط روی گوشی مدیرها نصب می‌شود. کنار اپ معمولی نصب می‌شود و با آن قاطی نمی‌شود.
- در Gradle یک flavor جداست (`android/app/build.gradle`: `user` و `admin`). اسم و رنگ آیکن در `android/app/src/admin/res`، و تنظیم Capacitor آن را `scripts/admin-config.mjs` بعد از هر `cap sync` از تنظیم اپ معمولی می‌سازد (`npm run sync` خودش اجرا می‌کند).
- User-Agent آن `frfro-app frfro-admin` است. سایت با `frfro-admin` می‌فهمد این اپ مدیر است: بعد از ورود مدیر، توکن اعلان را در `admin_push_tokens` می‌گذارد (`/api/admin/push/native`)، نه در توکن‌های کاربران. اعلان کاربری در این اپ خاموش است.
- اعلانش (پشتیبانی تازه، گزارش تخلف، بازیابی رمز، پرداخت تازه) وقتی کار می‌کند که اپ `ir.frfro.admin` هم در همان پروژهٔ Firebase اضافه شده و `google-services.json` تازه در مخزن باشد. تا آن موقع اپ ساخته می‌شود و کار می‌کند، فقط اعلان ندارد.

## اعلان (Push)
اعلان مرورگر (Web Push) داخل WebView کار نمی‌کند، پس اپ اعلان خودش را دارد: `@capacitor/push-notifications` با Firebase، کانال «نوبت‌ها و پیام‌ها» با صدا و لرزش (`FrfroPushPlugin.java`)، آیکن کوچک `res/drawable/ic_stat_frfro.xml`. سایت در `app/shared/lib/nativePush.js` اجازه می‌گیرد و توکن را ذخیره می‌کند؛ با زدن اعلان، همان صفحه باز می‌شود. برای کار کردنش `android/app/google-services.json` لازم است (بدون آن اپ سالم می‌ماند و فقط اعلان ندارد). راه‌اندازی و قاعدهٔ پیامک: `docs/OPERATIONS.md` «اعلان اپ اندروید». آیفون هنوز اپ ندارد و پیامک می‌گیرد.
