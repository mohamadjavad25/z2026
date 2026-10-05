# معماری زیبابان (وضعیت ۵ اکتبر ۲۰۲۶)

## لایه‌ها
- **Next.js 16 (App Router) + React 19**، پایگاه داده Postgres (`pg`)، مایگریشن با `node-pg-migrate` (در دیپلوی Vercel خودکار).
- **`app/api/**`**: route handlerها. همه با `withErrorHandling`، اعتبارسنجی با zod (`validateBody`: پیام کاربر فقط فارسی)، نرخ‌محدودی روی دیتابیس، سشن با کوکی httpOnly.
- **`app/lib/db/repos/**`**: تنها جایی که SQL می‌نویسد. route‌ها فقط repo صدا می‌زنند.
- **`app/lib/*Sweep.js` / `bookingReminders.js`**: کارهای زمان‌بندی‌شده؛ با endpointهای `app/api/cron/*` و workflowهای GitHub Actions اجرا می‌شوند (نه تایمر درون‌پروسه، چون سرورلس است).
- **`app/features/<دامنه>`**: رابط به تفکیک دامنه (auth، profile، salons، artist، client، schedule، settings، shell). هر دامنه hook(های) داده + کامپوننت‌های ارائه‌ای دارد.
- **`app/shared`**: کدی که چند دامنه می‌خواهند: `api/` (کلاینت `apiFetch` با نوار busy شبکه و خطای یکدست)، `lib/` (تاریخ شمسی، پول، رقم، زمان‌بندی یادآوری، آواتار پیش‌فرض…).
- **`app/components`**: کامپوننت‌های مشترک؛ `components/ui` کتابخانهٔ پایه (`Button`، `Chip`، `Field`).

## پوستهٔ اصلی (`features/shell`)
`HomeApp.jsx` فقط سیم‌کشی است: hookهای دامنه را صدا می‌زند و کامپوننت‌ها را کنار هم می‌گذارد. منطق جدا شده:
- hookها: `useShellNavigation` (باز کردن پروفایل‌ها/پست‌ها)، `useScheduleViews` (تب‌ها/برنامهٔ روز)، `useSalonDerived`، به‌اضافهٔ `useProfileEditor`، `useServiceComposer`، `useBookingCreateSheet`…
- کامپوننت‌ها در `shell/home/`: `ProfilePanelBody`، شیت‌های اعلان، `OwnerBookingSheet`، `PushSoftAsk`.
- `useSalonWorkspace` و `useArtistWorkspace` هم به hookهای زیرمجموعه (`useSalonCatalogActions`، `useSalonPortfolioActions`، `useSalonInviteActions`، `useArtistHours`، `useArtistRailDrag`، `useArtistWorkActions`) شکسته شده‌اند.

## استایل
- `styles/tokens.css`: توکن‌ها (رنگ، فاصله، شعاع، متن، سایه، حرکت) و **مقیاس z-index**؛ عدد خام ≥۱۰۰ بیرون از این فایل تست را رد می‌کند.
- `styles/ui.css`: استایل کتابخانهٔ پایه (فقط کلاس‌های `ui-*`).
- `styles/features/*.css`: استایل هر دامنه. `styles/legacy/part-NN.css`: استایل قدیمی به ترتیب cascade اصلی (تقسیم‌شده از یک فایل ~۲۴ هزار خطی؛ بدون تغییر ظاهر، پیکسل‌به‌پیکسل راستی‌آزمایی شد). استایل جدید را در فایل دامنه‌اش بنویس، نه اینجا.

## تست
- `tests/unit`: منطق خالص (تاریخ، اعتبارسنجی فرم، زمان‌بندی یادآوری، مقیاس z-index).
- `tests/integration`: روی سرور واقعی `next start` و Postgres واقعی (Testcontainers در CI).
- `tests/e2e`: Chromium واقعی: خطاهای فارسی فرم، فلو کامل رزرو (مشتری → سالن → تأیید)، اسموک موبایل ۳۶۰px، **axe بدون تخلف serious/critical**، تله‌ی فوکوس شیت‌ها، کارت تکمیل پروفایل.

## قواعد
۱. SQL فقط در repo. ۲. پیام خطای کاربر فارسی. ۳. استایل جدید با توکن و کلاس `ui-*` یا کلاس دامنه؛ بدون قاعدهٔ عمومی روی `input/label`. ۴. هر درخواست UI از `apiFetch`. ۵. هر فیچر UI: E2E یا حداقل اسکرین‌شات قبل/بعد.
