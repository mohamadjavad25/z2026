# Known issues

> **توجه (۲۶ سپتامبر ۲۰۲۶):** چت، کیف‌پول و نوع حساب «فروشگاه» در ۲۳ سپتامبر ۲۰۲۶ به‌طور کامل از محصول حذف شدن (جزئیات در `docs/DEVLOG.md`). موارد زیر که به Wallet/Shop/AI Studio/Chat اشاره می‌کنن صرفاً سابقه‌ی تاریخی‌ان و دیگه به کد فعلی مربوط نیستن — محصول الان فقط شامل مشتری/آرتیست/سالن و رزرو مستقیمه.

## باگ شناخته‌شده: خطای 500 در changeShellBalance — رفع‌شده (فاز Wallet)

- **محل:** `app/lib/db/repos/wallet.js` + `app/lib/db/connection.js`
- **علت قطعی:** `node:sqlite` / `DatabaseSync` متد `db.transaction()` ندارد (برخلاف better-sqlite3). فراخوانی `db.transaction(...)` → `TypeError: db.transaction is not a function` → HTTP 500.
- **رفع:** helper صریح `withTransaction(db, fn)` با `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`؛ موجودی با `UPDATE ... SET x = x + ? WHERE ... AND x + ? >= 0` اتمیک؛ `CHECK (>= 0)` روی balances در schema v11؛ `PRAGMA journal_mode=WAL`.
- **امنیت مالی مرتبط:** `demo_credit` در `NODE_ENV=production` → 403؛ `feePercent` فقط از ثابت سرور؛ برداشت همیشه `pending` تا `confirm_withdraw` با `FRFRU_WALLET_ADMIN_TOKEN`.
- **تست:** `node scripts/seed-wallet-test.mjs` (DB ایزوله `frfru-wallet-test.sqlite`)
- **وضعیت:** رفع‌شده — ۳ اوت ۲۰۲۶

---

## سرور wallet در برابر درخواست‌های موازی idempotent نیست — رفع‌شده

- **کشف‌شده در:** فاز UX (busy state تست C2)، ۳ اوت ۲۰۲۶.
- **رفتار قبلی:** دو `POST /api/wallet` موازی (بدون gate کلاینت) هر دو موفق می‌شدند و هر دو اثر می‌گذاشتند (مثلاً شارژ دوبار انجام می‌شد). busy state کلاینت (`walletBusy`) فقط UI عادی را می‌پوشاند؛ دو تب باز، ریترای شبکه‌ای، یا درخواست مستقیم به API همچنان باعث دوبار اجراشدن می‌شد.
- **رفع:**
  - **schema v19:** جدول `wallet_idempotency_keys (user_id, kind, key, response_json, PRIMARY KEY(user_id, kind, key))`.
  - `app/lib/db/repos/wallet.js`: `readIdempotentResult` / `storeIdempotentResult` — هر دو **داخل همان `withTransaction`** فراخوانی مثل مطلق مربوطه (`creditCash` برای demo_credit/booking_earn، `requestWithdraw`)، پس چک-کلید و آپدیت موجودی اتمیک هستند؛ چون `BEGIN IMMEDIATE` نویسنده‌ها را serialize می‌کند، دومین درخواست همزمان با همان کلید منتظر commit اولی می‌ماند و بعد نتیجهٔ ذخیره‌شده را برمی‌گرداند نه اجرای دوباره.
  - **API:** `POST /api/wallet` فیلد `idempotencyKey` را در body برای `kind: "demo_credit"` و `kind: "withdraw"` می‌پذیرد و به repo پاس می‌دهد.
  - **کلاینت:** `app/features/wallet/useWalletWorkspace.js` → `requestWalletCharge` و `requestWalletWithdraw` هر دو با `crypto.randomUUID()` یک idempotency key یکتا per-click می‌سازند، پس double-click / دو تب / ریترای شبکه همان کلید را دوباره می‌فرستد نه کلید جدید.
- **تست:** `node scripts/seed-wallet-test.mjs` — موارد ۷/۷b/۷d: دو `creditCash` واقعاً همزمان (worker_threads + اتصال جدا به DB) با یک idempotencyKey → فقط یک بار net اعمال می‌شود؛ replay بعدی از همان کلید از طریق HTTP هم موجودی را عوض نمی‌کند؛ همین برای `requestWithdraw` (دو withdraw همزمان با یک کلید → فقط یک withdrawal ثبت می‌شود، یک ردیف در `wallet_idempotency_keys`).
- **وضعیت:** رفع‌شده — ۱۷ سپتامبر ۲۰۲۶ (پوشش تست idempotency اضافه شد؛ پیاده‌سازی سرور/کلاینت از قبل موجود بود ولی این سند به‌روز نشده بود).

---

## نیاز به چک بصری دستی (batch)

فازهای JSX با تست خودکار (ساختاری) پاس شده بودند؛ چک بصری در مرورگر انجام شد و مشکلات پیدا و رفع شدند:

- J1: Shop UI (`ShopProductsOverview`, `ShopInsightsPanel`, `ShopOrdersPanel`, `ShopProductDetailModal`, `ShopProductEditorSheet`) — **چک بصری انجام شد — مشکلات پیدا و رفع شدند**
- J2: Artist owner UI (`ArtistOverviewReviews`, `ArtistServicesPanel`, `ArtistWorkPreviewModal`, `ArtistBreakEditorModal`) — **چک بصری انجام شد — مشکلات پیدا و رفع شدند**
- J3: Client UI (`ClientBookingsPanel`, `ClientBookingSettingsModal`) — **چک بصری انجام شد — مشکلات پیدا و رفع شدند** (`ClientModelsOverview` صرف‌نظر شده بود)
- J4: Salon owner UI (`SalonStaffWorkspace`, `SalonServicesWorkspace`, `SalonStaffProfileModal`, `SalonCreateStaffModal`, `SalonNearbyInviteSheet`, `SalonToolSheets`) — **چک بصری انجام شد — مشکلات پیدا و رفع شدند**
- J5: Shared profile UI (`ProfileHero`, `ProfileSettingsSheet`+`SalonHoursEditor`, `ServiceComposerModal`, `OwnerChatSheet`) — **چک بصری انجام شد — مشکلات پیدا و رفع شدند**
- J6: Schedule surface (`SalonScheduleDashboard`, `ArtistScheduleBoard`, `ScheduleBookingMenuModal`) — **چک بصری انجام شد — مشکلات پیدا و رفع شدند**
- J7: AI / Explore / Wallet + shell leftovers (`AiStudioPage`, `ExplorePage`+`ExplorePreviewModal`+`ExploreRatingModal`, `WalletPage`, `MobileFloatingCta`, `ClientProfileModal`, `ProfileEditModal`, `BeautyPassportSheet`) — **چک بصری انجام شد — مشکلات پیدا و رفع شدند**

---

## چک بصری تکمیل شد

- **تاریخ:** ۳ اوت ۲۰۲۶
- **نتیجه:** چک بصری کامل J1–J7 در مرورگر انجام شد؛ چند مورد جزئی (که کاربر مشخص کرده) پیدا و رفع شد.

---

## تصمیم معماری: scheduleNow / scheduleViewDay / scheduleBookingMenu

- **محل نگهداری:** `HomeApp.jsx` (یا بعداً یک hook مشترک مثل `useBookingSchedule`) — **نه** داخل `useSalonDirectory`
- **دلیل:** این state بین UI برنامهٔ روزانهٔ owner سالن و owner آرتیست مشترک است؛ قفل کردنش داخل hook مشتری سالن، استخراج بعدی Artist owner را سخت می‌کند
- **اتصال رزرو مشتری:** `confirmSalonClientBooking` فقط از طریق callback اختیاری `onOwnerBookingsSync` لیست owner را به‌روز می‌کند اگر رزروکننده همان سالن باشد؛ مسیر عادی مشتری → `POST /api/salon-bookings` است
- **اتصال artist bookings:** در route سرور، اگر staff لینک‌شده به آرتیست داشته باشد، `addArtistBooking` صدا زده می‌شود — خارج از دامنهٔ salon-client hook
- **ثبت‌شده در:** استخراج salon-client (۲ اوت ۲۰۲۶)

---

## وضعیت واقعی تشخیص تداخل رزرو سالن — رفع‌شده (۳ اوت ۲۰۲۶)

- **قبل:** فقط تساوی خام `time` (+ staff)؛ overlap duration و ارقام فارسی/لاتین نادیده گرفته می‌شدند. تست `seed-salon-conflict-test.mjs` → S1/S3 FAIL، S2 PASS.
- **رفع:**
  - schema **v12:** ستون `duration_minutes` روی `salon_bookings` + migration نرمال‌سازی `time` به لاتین `HH:MM` و backfill duration از `salon_services`
  - `addSalonBooking` / `updateSalonBooking`: overlap با `rangesOverlap` + `timeLabelToMinutes` / `normalizeBookingTimeLabel`؛ درج داخل `withTransaction` (`BEGIN IMMEDIATE`)
  - **staff="":** رزرو بدون staff با هر رزرو هم‌پوشان همان روز تداخل دارد؛ staff مشخص فقط با همان staff (حفظ رفتار قبلی exact-time)
- **تست:** `seed-salon-conflict-fix-test.mjs` ۱۳/۱۳؛ `seed-salon-conflict-test.mjs` ۱۰/۱۰ (S1/S2/S3) — هر دو `--cleanup`
- **وضعیت:** رفع‌شده

---

## هماهنگی فاز Public artist ↔ Artist owner (به‌روز پس از استخراج owner)

- **رزرو از مودال عمومی:** `usePublicArtistProfile` → **`POST /api/artist/bookings`**.
- **رزرو از workspace آرتیست:** `useArtistWorkspace` → **`POST /api/artist/me`** با `kind: "booking"`.
- **بک‌اند مشترک:** هر دو به `artists.addArtistBooking` / جدول `artist_bookings`.
- **Sync UI بعد از استخراج Artist owner:**
  1. Polling هر ۸ث `GET /api/artist/me` با گارد `artistBookingsEpochRef` (بدون bump در poll؛ bump در refresh کامل و create محلی).
  2. Callback صریح `onArtistBookingCreated(artistUserId)` از public modal → اگر `createdProfile` همان آرتیست باشد، bump + `refreshArtistWorkspace` فوری (بدون صبر برای poll).
- **scheduleNow / scheduleViewDay / scheduleBookingMenu:** همچنان در HomeApp (مشترک با salon owner).
- **Explore → public artist:** `openExploreArtistProfile` در HomeApp مانده؛ فقط وقتی هدف آرتیست است `openPublicArtistProfile` را صدا می‌زند.
- **ثبت‌شده در:** استخراج artist-owner (۲ اوت ۲۰۲۶)

---

## هماهنگی فاز Salon owner (به‌روز پس از استخراج)

- **Owner dashboard:** `useSalonWorkspace` — staff/services/portfolio/hours/collabs/invites/bookings + epoch/poll ۸ث.
- **Client directory:** `useSalonDirectory` — بدون owner state.
- **Self-book sync:** `onOwnerBookingsSync` فقط وقتی `salonUserId === createdProfile.id` (سالن روی storefront خودش) → `applySalonBookings({ bump: true })`. برای مشتری session جداگانه **فقط poll** معتبر است؛ realtime مصنوعی بین sessionها اضافه نشده.
- **Linked artist:** بعد از `createSalonBooking` موفق، اگر `linkedArtistId` باشد → `notifyArtistBookingCreated(linkedArtistId)` در همان React tree.
- **schedule triad:** در HomeApp مانده؛ `normalizeSalonScheduleBooking` اکنون `ownerType: "salon"` می‌گذارد.
- **salon-hours PATCH:** route حالا `{ hour, hours }` برمی‌گرداند تا UI لیست را خالی نکند.
- **ثبت‌شده در:** استخراج salon-owner (۲ اوت ۲۰۲۶)

---

## PATCH `/api/salon-bookings` ↔ `artist_bookings` — رفع‌شده (۳ اوت ۲۰۲۶)

- **قبل:** PATCH فقط ردیف `salon_bookings` را عوض می‌کرد؛ آینه‌ی `artist_bookings` برای staff لینک‌شده به آرتیست عقب می‌ماند (زمان/لغو/تعویض staff).
- **فیلدهای قابل PATCH:** `client`, `phone`, `service`, `staff`, `booking_date` / `bookingDate` / `date`, `time`, `durationMinutes` / `duration_minutes` / `duration`, `status`؛ لغو با `status: "لغو"` یا `action: "cancel"`.
- **رفع:** `patchSalonBookingWithArtistSync` در یک `withTransaction` هم سالن را آپدیت می‌کند هم آینهٔ آرتیست را.
- **سیاست تعویض staff:**
  - همان آرتیست لینک‌شده → UPDATE روی همان `artist_bookings`
  - لغو سالن → soft-cancel آینه (`status = لغو`، حذف فیزیکی نه)
  - لینک A → staff بدون لینک → soft-cancel روی A
  - لینک A → لینک B → soft-cancel روی A + INSERT روی B (تداخل اسلات B کل تراکنش را rollback می‌کند)
  - بدون لینک → لینک B → INSERT روی B
- **UI notify:** پاسخ PATCH شامل `linkedArtistId` / `linkedArtistIds`؛ `patchSalonAppointment` → `onLinkedArtistBooked` → `notifyArtistBookingCreated`.
- **تست:** `seed-booking-patch-sync-test.mjs` — ۲۴/۲۴ PASS (`frfru-booking-patch-sync-test.sqlite` + `--cleanup`)
- **وضعیت:** رفع‌شده

---

## وضعیت نهایی استخراج JSX/CSS (J1–J7)

- **JSX extraction complete (J1–J7):** پنل‌های دامنه از HomeApp جدا شده‌اند. **HomeApp نهایی ≈ 3012 خط.**
- **CSS:** `app/styles/features/*.css` از طریق `@import` در `styles.css`؛ بخش عمده قوانین دامنه منتقل شد. قوانین multi-selector مشترک (مثلاً `.aiStudio, .feedPanel, .salonPanel, …`) و ترکیب با `segmentClock` / chrome شل عمداً در monolith مانده‌اند.
- **Integration:** `seed-integration-test.mjs` — ۱۸/۱۸ PASS (پس از J7 CSS).

---

## جمع‌بندی موارد باز / حل‌نشده (تا الان)

### هنوز باز — نیاز به کار یا تأیید دستی

*(هیچ مورد بحرانی باز نیست.)* موارد زیر یادداشت معماری / غیر فوری‌اند، نه باگ runtime:

1. **schedule triad در HomeApp** — `scheduleNow` / `scheduleViewDay` / `scheduleBookingMenu` هنوز در HomeApp مانده (تصمیم معماری؛ نه در `useSalonDirectory`). استخراج hook جدا (`useBookingSchedule`) انجام نشده.
2. **State پروفایل / schedule memos** — بعد از J5/J6 بخشی از state و interval/memos هنوز در HomeApp است (عمدی برای هماهنگی ownerها).
3. **ClientModelsOverview** — خارج از استخراج J3 مانده (mock / ناقص بودن داده).

### حل‌شده / بسته (خلاصه)

- Wallet `changeShellBalance` 500 (`withTransaction` + WAL) — رفع‌شده؛ تست wallet جدا.
- تشخیص تداخل رزرو سالن (duration overlap + ارقام فارسی/لاتین + race) — رفع‌شده؛ `seed-salon-conflict-fix-test.mjs`.
- Sync رزرو public-artist → artist-owner (poll + `onArtistBookingCreated`) — پیاده‌سازی شده؛ تست artist-owner.
- Sync self-book سالن → owner dashboard (`onOwnerBookingsSync` + poll) — پیاده‌سازی شده؛ تست salon-owner.
- استخراج JSX دامنه J1–J7 + انتقال CSS متناظر — انجام شده؛ integration ۱۸/۱۸ سبز.
- Visual QA batch (J1–J7) — چک بصری انجام و موارد جزئی رفع شد.
- **PATCH `/api/salon-bookings` → sync `artist_bookings`** — رفع‌شده (۳ اوت ۲۰۲۶)؛ تست `seed-booking-patch-sync-test.mjs` ۲۴/۲۴.
- **UX false-success (C1/C7/C8)** — رفع‌شده (۳ اوت ۲۰۲۶)؛ جزئیات در `UX_ISSUES.md`؛ تست `seed-ux-false-success-test.mjs`.
- **UX busy / double-submit (C2–C6)** — رفع‌شده (۳ اوت ۲۰۲۶)؛ جزئیات در `UX_ISSUES.md`؛ تست `seed-ux-busy-test.mjs`.
- **Wallet idempotency سمت سرور (درخواست‌های موازی)** — رفع‌شده (۱۷ سپتامبر ۲۰۲۶)؛ `wallet_idempotency_keys` (schema v19) + `withTransaction`؛ تست `seed-wallet-test.mjs` #7/#7b/#7d.
- **حذف کامل چت/کیف‌پول/فروشگاه** — انجام‌شده (۲۳ سپتامبر ۲۰۲۶)؛ مایگریشن v36 (drop جداول) + v37 (حذف ریویو/امتیاز/استوری)؛ جزئیات در `docs/DEVLOG.md`.
- **مودال‌های تمام‌صفحه‌ای که به‌جای portal مستقیم داخل درخت رندر می‌شدن، به‌خاطر `transform` روی `.mobilePage.is-active` (باقی‌مونده انیمیشن ورود تب)، به‌جای کل صفحه نسبت به کانتینر تب موقعیت می‌گرفتن** — رفع‌شده (۲۶ سپتامبر ۲۰۲۶)؛ مودال ساعت کاری و toast سراسری اپ حالا با `createPortal(..., document.body)` رندر می‌شن. اگه مودال/شیت جدیدی داخل یه تب (نه از طریق `ProfileSheet.jsx`) اضافه می‌شه، باید همین الگو رعایت بشه وگرنه همین باگ تکرار می‌شه.
- **اکسپلور حذف و با تب تنظیمات جایگزین شد** — انجام‌شده (۲۶ سپتامبر ۲۰۲۶)؛ جزئیات در `docs/DEVLOG.md`.

### یادداشت معماری باز (غیر باگ فوری)

- Realtime کامل رزرو بین sessionها نیست؛ poll + callback intra-tree.
- `salon-hours` PATCH باید شکل `{ hour, hours }` را با UI هم‌تراز نگه دارد.
- Explore → public artist از مسیر `openExploreArtistProfile` / `openPublicArtistProfile` در HomeApp.

---

تمام موارد بحرانی شناخته‌شده تا ۳ اوت ۲۰۲۶ رفع شده‌اند؛ فهرست کامل فازهای انجام‌شده در پایین است.

### فازهای انجام‌شده (فهرست کامل)

1. Wallet atomic balance / `withTransaction` + WAL  
2. Public-artist ↔ Artist-owner booking sync (+ notify)  
3. Salon-client / Salon-owner extraction + self-book owner sync  
4. JSX/CSS extraction J1–J7 + visual QA fixes  
5. Salon conflict detection (schema v12 + overlap + digits + race)  
6. PATCH salon-bookings ↔ artist_bookings atomic sync (+ notify)  
7. UX فاز ۱: false-success toasts (C1 salon mutations, C7 AI spend, C8 beauty passport) — `UX_ISSUES.md`  
8. UX فاز ۲: busy/double-submit (C2–C6 buyShells / bookings / schedule / approve) — `UX_ISSUES.md`
