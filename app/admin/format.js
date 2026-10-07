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
  support_update: "رسیدگی به پشتیبانی"
};

export const CATEGORY_LABEL = { question: "سؤال", bug: "مشکل فنی", complaint: "شکایت", account: "مشکل حساب", other: "سایر" };
export const REASON_LABEL = { spam: "اسپم یا تبلیغ", inappropriate: "محتوای نامناسب", fake: "جعلی یا گمراه‌کننده", copyright: "کپی از دیگران", other: "سایر" };
export const STATUS_LABEL = { open: "باز", in_progress: "در حال بررسی", closed: "بسته" };
export const RESOLUTION_LABEL = { answered: "پاسخ داده شد", hidden_post: "پست پنهان شد", suspended_user: "حساب مسدود شد", dismissed: "ایرادی نبود" };

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
export const num = (value) => toPersianDigits(Number(value || 0).toLocaleString("en-US").replace(/,/g, "٬"));
