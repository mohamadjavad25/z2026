import { toPersianDigits } from "../shared/lib/digits";

export const TYPE_LABEL = { client: "مشتری", artist: "آرتیست", salon: "سالن" };
export const PAGE = 25;

export const ACTION_LABEL = {
  suspend: "مسدود شد",
  unsuspend: "رفع مسدودی",
  resolve_password_reset: "رمز بازنشانی شد",
  login: "ورود مدیر",
  login_failed: "ورود ناموفق",
  login_blocked: "ورود مسدود (تلاش زیاد)",
  enroll: "راه‌اندازی Authenticator",
  enroll_failed: "راه‌اندازی ناموفق",
  stepup: "تأیید دوباره",
  stepup_failed: "تأیید دوباره ناموفق",
  force_logout: "خروج اجباری کاربر",
  delete_user: "حذف حساب",
  post_hide: "پنهان‌کردن پست",
  post_show: "نمایش دوبارهٔ پست",
  post_delete: "حذف پست",
  revoke_sessions: "پایان نشست مدیر",
  reset_authenticator: "ریست Authenticator مدیر",
  support_update: "رسیدگی به پشتیبانی",
  edit_user: "ویرایش پروفایل کاربر",
  set_password: "تعیین رمز جدید برای کاربر",
  booking_cancel: "لغو رزرو توسط مدیر",
  broadcast: "پیام همگانی",
  settings_update: "تغییر تنظیمات",
  export: "خروجی اکسل",
  cleanup: "پاک‌سازی سامانه",
  clear_errors: "پاک‌کردن خطاهای اپ",
  billing_settings: "تغییر تنظیمات اشتراک",
  billing_grant: "افزودن روز به اشتراک",
  billing_reverify: "بررسی دوبارهٔ پرداخت",
  billing_refund: "ثبت بازپرداخت",
  device_key_issued: "روشن‌کردن پس‌زمینه یا همیشه‌روشن اپ مدیر",
  device_key_revoked: "خاموش‌کردن پس‌زمینه و همیشه‌روشن اپ مدیر"
};

/** Filters for the audit log (the same groups as ACTION_GROUPS on the server). */
export const ACTION_GROUP_LABEL = { accounts: "حساب‌ها", content: "محتوا", bookings: "رزروها", billing: "اشتراک و پرداخت", support: "پشتیبانی و پیام", system: "تنظیمات و خروجی", security: "ورود و امنیت" };

/** Booking statuses are stored in Persian already; this only says how loud each one should look. */
export const BOOKING_TONE = { "تازه": "warn", "درخواست": "warn", "در انتظار مشتری": "info", "تایید شده": "good", "لغو": "bad", "منقضی شده": "muted" };

/** Who a broadcast can go to (keys match SEGMENTS on the server). */
export const SEGMENT_LABEL = {
  all: "همهٔ کاربران",
  client: "مشتری‌ها",
  pro: "سالن‌ها و آرتیست‌ها",
  salon: "فقط سالن‌ها",
  artist: "فقط آرتیست‌ها",
  new7: "تازه‌واردهای این هفته",
  inactive30: "کسانی که ۳۰ روز سر نزده‌اند",
  incomplete: "سالن و آرتیستِ بدون خدمت"
};

export const CATEGORY_LABEL = { question: "سؤال", bug: "مشکل فنی", complaint: "شکایت", account: "مشکل حساب", other: "سایر" };
export const REASON_LABEL = { spam: "اسپم یا تبلیغ", inappropriate: "محتوای نامناسب", fake: "جعلی یا گمراه‌کننده", copyright: "کپی از دیگران", other: "سایر" };
export const STATUS_LABEL = { open: "باز", in_progress: "در حال بررسی", closed: "بسته" };
export const RESOLUTION_LABEL = { answered: "پاسخ داده شد", hidden_post: "پست پنهان شد", suspended_user: "حساب مسدود شد", dismissed: "ایرادی نبود", broadcast: "پیام همگانی" };

/** "5 minutes ago" style, in Persian. */
export function ago(value) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return "همین الان";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  return rtf.format(Math.round(seconds / 86400), "day");
}

export const fmtDate = (value) => (value ? toPersianDigits(new Intl.DateTimeFormat("fa-IR-u-nu-latn", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(value))) : "—");
export const fmtDay = (value) => (value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeZone: "Asia/Tehran" }).format(new Date(value)) : "—");
/** "1405-07-23" (a stored Persian date key) shown with Persian digits. */
export const fmtKey = (key) => (key ? toPersianDigits(String(key).replace(/-/g, "/")) : "—");
/** A stored "10:00" time with Persian digits. */
export const fmtTime = (value) => (value ? toPersianDigits(String(value)) : "—");
export const bytes = (value) => {
  const n = Number(value || 0);
  if (n < 1024) return `${num(n)} بایت`;
  if (n < 1024 ** 2) return `${toPersianDigits((n / 1024).toFixed(1))} کیلوبایت`;
  if (n < 1024 ** 3) return `${toPersianDigits((n / 1024 ** 2).toFixed(1))} مگابایت`;
  return `${toPersianDigits((n / 1024 ** 3).toFixed(2))} گیگابایت`;
};
export const num = (value) => toPersianDigits(Number(value || 0).toLocaleString("en-US").replace(/,/g, "٬"));

/** Subscription payments (repos/billing.js): status words and how loud each looks. */
export const PAYMENT_STATUS = { paid: { label: "پرداخت‌شده", tone: "good" }, pending: { label: "در انتظار", tone: "warn" }, failed: { label: "ناموفق", tone: "bad" }, refunded: { label: "بازپرداخت‌شده", tone: "warn" } };
/** Where a salon or artist stands (app/lib/billing/period.js). */
export const ACCOUNT_STATE = {
  trial: { label: "ماه رایگان", tone: "info" },
  active: { label: "اشتراک فعال", tone: "good" },
  grace: { label: "مهلت تمدید", tone: "warn" },
  expired: { label: "غیرفعال", tone: "bad" }
};
/** "۲٬۵۰۰٬۰۰۰ تومان" */
export const toman = (value) => `${num(value)} تومان`;
