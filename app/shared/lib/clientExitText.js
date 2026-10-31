import { toPersianDigits } from "./digits.js";

/** The words of a client's account deletion while bookings are open (owner's decision 2026-10-26). */

export const CANCEL_ALL_AND_DELETE = "لغو همه و پاک کردن حساب";

/** Confirmed bookings within 24 hours: they block the deletion. */
export function clientBlockedText(count) {
  return count > 1
    ? `${toPersianDigits(count)} نوبت تا ۲۴ ساعت دیگه داری. تا انجام نشن یا لغوشون نکنی، نمی‌تونی حسابت رو پاک کنی.`
    : "یه نوبت تا ۲۴ ساعت دیگه داری. تا انجام نشه یا لغوش نکنی، نمی‌تونی حسابت رو پاک کنی.";
}

/** Farther bookings and waiting requests: they are cancelled together with the deletion. */
export function clientRestText(items = []) {
  const bookings = items.filter((item) => item.confirmed).length;
  const requests = items.length - bookings;
  const parts = [
    bookings ? `${toPersianDigits(bookings)} نوبت` : "",
    requests ? `${toPersianDigits(requests)} درخواست` : ""
  ].filter(Boolean).join(" و ");
  return `${parts} باز داری. با پاک کردن حساب، همه لغو می‌شن و به سالن یا آرتیستش خبر می‌دیم.`;
}

/** Before the client cancels a near booking themselves. */
export function clientCallFirstText(providerName) {
  return `اول به ${providerName || "سالن"} زنگ بزن، بعد لغو کن.`;
}
