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
  reset_authenticator: "ریست Authenticator مدیر"
};

export const fmtDate = (value) => (value ? toPersianDigits(new Intl.DateTimeFormat("fa-IR-u-nu-latn", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(value))) : "—");
export const num = (value) => toPersianDigits(Number(value || 0).toLocaleString("en-US").replace(/,/g, "٬"));
