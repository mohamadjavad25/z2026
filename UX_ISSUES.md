# UX Issues Tracker

پایه: ممیزی UX (۳ اوت ۲۰۲۶). موارد بحرانی C1–C8 از همان ممیزی.

> **توجه (۲۶ سپتامبر ۲۰۲۶):** چت، کیف‌پول، فروشگاه و استودیو AI در ۲۳ سپتامبر ۲۰۲۶ به‌طور کامل حذف شدن (`docs/DEVLOG.md`). مواردی که در این فایل به Wallet/Shop/AI Studio/Chat اشاره می‌کنن (مثل C2, C7, M2, M8, M11, M12) دیگه به کد فعلی مربوط نیستن و صرفاً سابقه‌ی تاریخی‌ان.

## فاز ۱ — موفقیت دروغین (false-success toasts)

### C1 — `useSalonWorkspace` mutationها بدون چک `ok` — **رفع‌شده** (۳ اوت ۲۰۲۶)

- **قبل:** `addSalonStaff`, `updateSalonStaff`, `updateSalonHour`, `updateSalonHoursPreset`, `deleteSalonService` همیشه toast موفقیت می‌دادند حتی روی 401/403/404.
- **رفع:** هلپر مشترک `notifyFromResponse` / `getApiErrorMessage` در `app/shared/lib/apiNotify.js`؛ قبل از هر `setState` و toast موفقیت، `ok` چک می‌شود؛ در fail فقط `payload.error` (سپس message/fallback).
- **تست:** `node scripts/seed-ux-false-success-test.mjs`

### C7 — `useAiStudio.createAiPreview` پیام ثابت موجودی — **رفع‌شده** (۳ اوت ۲۰۲۶)

- **قبل:** روی هر `!ok` همیشه «موجودی کافی نیست؛ اول شل بخر.»
- **رفع:** `getApiErrorMessage(payload, "مصرف شل انجام نشد؛ …")`؛ سرور برای موجودی ناکافی خودش «موجودی شل کافی نیست.» برمی‌گرداند؛ `onNeedShell` فقط وقتی متن خطا به موجودی اشاره دارد.

### C8 — `HomeApp.activateBeautyPassport` فیلد اشتباه — **رفع‌شده** (۳ اوت ۲۰۲۶)

- **قبل:** `payload.message` در حالی که API فقط `error` می‌فرستد → همیشه fallback عمومی.
- **رفع:** `getApiErrorMessage(payload, fallback)` با اولویت `error` سپس `message` سپس fallback.

---

## فاز ۲ — double-submit / busy (C2–C6)

### C2 — `HomeApp.buyShells` بدون `walletBusy` — **رفع‌شده** (۳ اوت ۲۰۲۶)

- `walletBusyRef` + `setWalletBusy` مثل charge/withdraw؛ دکمه‌های شل در `WalletPage` `disabled={walletBusy}`.
- پیام خطا از `getApiErrorMessage`.

### C3 — `confirmPublicArtistBooking` بدون busy — **رفع‌شده** (۳ اوت ۲۰۲۶)

- `publicArtistBookingBusy` + ref؛ CTA مودال `disabled` + «در حال ثبت...».

### C4 — owner booking create بدون busy — **رفع‌شده** (۳ اوت ۲۰۲۶)

- `salonBookingSubmitting` / `artistBookingSubmitting`؛ `BookingCreateForm.submitting` و `ArtistBookingRail.createSubmitting`.

### C5 — schedule menu cancel/time/staff بدون busy — **رفع‌شده** (۳ اوت ۲۰۲۶)

- یک `scheduleBookingBusy` مشترک روی `patchSalonAppointment`؛ `ScheduleBookingMenuModal.busy` همهٔ اکشن‌های منو را disable می‌کند.

### C6 — approve reservation / collab بدون busy — **رفع‌شده** (۳ اوت ۲۰۲۶)

- `salonRequestBusyId` با کلید `reservation:{id}` / `collab:{id}` (مثل invite respond)؛ `SalonScheduleDashboard.requestBusyId`.

**الگو:** early-return روی ref همگام + state برای UI + `finally` برای آزادسازی. هلپر تستی: `app/shared/lib/busyGate.js`.

**تست:** `node scripts/seed-ux-busy-test.mjs`  
**یافته:** API کیف‌پول بدون gate کلاینت، دو POST موازی هر دو موفق می‌شوند (idempotent نیست) — busy کلاینت ضروری است.

---

## فاز ۳ — empty state + loading skeleton (M1 / M3 / M4)

### M4 — `HomeApp` auth boot با صفحه سفید (`opacity:0`) — **رفع‌شده** (۳ اوت ۲۰۲۶)

- قبل: `.appShell.is-auth-loading { opacity: 0 }` تا چک سشن تمام شود.
- رفع: `AuthBootScreen` (برند «زیبابان» + اسپینر RTL) به‌عنوان فرزند اول `appShell` وقتی `!authChecked`؛ CSS boot overlay در `shell.css`؛ `styles.css` دیگر محتوا را با opacity مخفی نمی‌کند بلکه visibility + overlay.

### M3 — پرش ناگهانی محتوا بدون skeleton — **رفع‌شده** (۳ اوت ۲۰۲۶)

- کامپوننت مشترک: `app/components/Skeleton.jsx` (`SkeletonBlock` / `SkeletonList` با `list|card|feed|row`).
- CSS shimmer: `app/styles/features/shell.css` (`.uxSkeleton*`).
- Wiring: Explore / Wallet / ShopProductsOverview / ShopStorefront / SalonScheduleDashboard / ArtistScheduleBoard با `loading` از هوک‌های مربوطه.

### M1 — `ShopStorefrontPage` بدون empty برای catalog/reviews — **رفع‌شده** (۳ اوت ۲۰۲۶)

- کاتالوگ خالی: پیام فارسی + CTA «بازگشت به فهرست فروشگاه‌ها».
- نظرات خالی: پیام راهنما (بدون فضای خالی خام).

**تست:** `node scripts/seed-ux-empty-skeleton-test.mjs` (ساختاری + SSR smoke بدون مرورگر)

---

## فاز ۴ — باقی‌ماندهٔ بلوک مهم (M2, M5–M13)

### M2 — OwnerChatSheet / ChatPage بدون empty — **رفع‌شده** (۳ اوت ۲۰۲۶)

- empty فارسی برای inbox و thread خالی با `ProfileEmptyState`؛ معماری mock چت عمداً دست نخورده.

### M5 — `client.css` بدون `@media` — **رفع‌شده** (۳ اوت ۲۰۲۶)

- زیر ۷۶۰px کارت رزرو stack می‌شود؛ `.clientBookingMore` حداقل ۴۴px.

### M6 — `.requestActions` روی موبایل کوچک‌تر می‌شد — **رفع‌شده** (۳ اوت ۲۰۲۶)

- موبایل: `min-height: 44px` (دیگر ۲۶px نیست).

### M7 — `toggleFollowSalon` بدون toast/rollback — **رفع‌شده** (۳ اوت ۲۰۲۶)

- `notifyFromResponse` + بازگرداندن `followedSalons` به حالت قبل روی fail/catch.

### M8 — `submitShopOrder` موفقیت جعلی محلی — **رفع‌شده** (۳ اوت ۲۰۲۶)

- **تصمیم:** وصل به `createShopOrder` / `POST /api/shop/orders` (endpoint از قبل آماده بود).
- toast موفقیت فقط بعد از `ok`؛ چک موجودی سمت کلاینت + سرور؛ `shopOrderBusy` روی دکمهٔ checkout.

### M9 — PublicArtistServicesPanel بدون empty — **رفع‌شده** (۳ اوت ۲۰۲۶)

- پیام «هنوز خدمتی ثبت نشده».

### M10 — گریدهای owner در `artist.css` — **رفع‌شده** (۳ اوت ۲۰۲۶)

- زیر ۷۶۰px: collab form / mini grid / booking rail row به ۱ ستون؛ ریل‌های عمومی شلوغ به ۲ ستون.

### M11 — `shops.css` insights / form — **رفع‌شده** (۳ اوت ۲۰۲۶)

- زیر ۷۲۰px همه به ۱ ستون (به‌جای ۲).

### M12 — Wallet empty ضعیف + chip ۳۴px — **رفع‌شده** (۳ اوت ۲۰۲۶)

- empty با آیکون/لحن پروژه؛ `walletQuickAmounts` حداقل ۴۴px.

### M13 — login/register بدون busy — **رفع‌شده** (۳ اوت ۲۰۲۶)

- `authBusy` / `authBusyRef` در `useAuthSession`؛ دکمه‌های submit در `AuthGateForms` disable.

**تست:** `node scripts/seed-ux-phase4-test.mjs`

---

## هنوز باز (از ممیزی — خارج از فاز ۱–۴)

بقیهٔ موارد Minor طبق گزارش ممیزی UX در چت (در صورت وجود).

---

## هلپرهای مشترک

- `app/shared/lib/apiNotify.js` — `getApiErrorMessage`, `notifyFromResponse`
- `app/shared/lib/busyGate.js` — `createBusyGate`, `createBusyIdGate` (آینهٔ الگوی ref در تست)
- `app/components/Skeleton.jsx` — `SkeletonBlock`, `SkeletonList`
- `app/features/shell/AuthBootScreen.jsx` — لودینگ چک سشن
