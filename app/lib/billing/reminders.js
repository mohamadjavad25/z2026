import { DAY_MS } from "./period.js";
import { toPersianDigits } from "../../shared/lib/digits.js";
import { formatPersianLongDate, formatPersianShortDate } from "../../shared/lib/billingFormat.js";

/**
 * Which subscription reminder is due for an account right now, and its words. Pure, so the timing is unit-tested
 * (tests/unit/billingReminders.test.js); the cron claims each (account, kind, end date) once before sending.
 *
 *   ends_5d  five days or fewer left (free month or paid period)
 *   ends_1d  less than a day left
 *   ended    access ended, grace days running: everything still works
 *   closed   grace over: out of search, no new online bookings (only within a week of closing, not forever)
 */
export const CLOSED_NOTICE_WINDOW_DAYS = 7;

export function reminderKind(access, now = new Date()) {
  if (access.state === "trial" || access.state === "active") {
    if (access.daysLeft <= 1) return "ends_1d";
    if (access.daysLeft <= 5) return "ends_5d";
    return null;
  }
  if (access.state === "grace") return "ended";
  const sinceClosed = new Date(now).getTime() - new Date(access.graceEndsAt).getTime();
  return sinceClosed >= 0 && sinceClosed < CLOSED_NOTICE_WINDOW_DAYS * DAY_MS ? "closed" : null;
}

/** Push text (title, body) and the SMS template + values for one reminder. `graceDays` is the setting (for "ended"). */
export function reminderMessage(kind, access, { graceDays = 3 } = {}) {
  const until = formatPersianLongDate(access.accessEndsAt);
  // SMS tokens may not contain spaces, so the SMS gets the short form (۱۴۰۵/۰۹/۲۴).
  const untilShort = formatPersianShortDate(access.accessEndsAt);
  const what = access.state === "trial" ? "ماه رایگانت" : "اشتراکت";
  if (kind === "ends_5d") {
    return {
      title: access.state === "trial" ? "ماه رایگانت رو به پایان است" : "اشتراکت رو به پایان است",
      body: `${what} ${toPersianDigits(access.daysLeft)} روز دیگر، ${until}، تمام می‌شود. برای ادامهٔ نوبت آنلاین، از تنظیمات اشتراک بخر.`,
      sms: { key: "billing_reminder", values: { days: toPersianDigits(access.daysLeft), until: untilShort } }
    };
  }
  if (kind === "ends_1d") {
    return {
      title: "کمتر از یک روز مانده",
      body: `${what} ${until} تمام می‌شود. با خرید اشتراک، نوبت آنلاین و دیده شدن در جست‌وجو بدون وقفه ادامه دارد.`,
      sms: { key: "billing_reminder", values: { days: toPersianDigits(1), until: untilShort } }
    };
  }
  if (kind === "ended") {
    return {
      title: "اشتراکت تمام شد",
      body: `تا ${toPersianDigits(graceDays)} روز دیگر همه‌چیز مثل قبل کار می‌کند. بعد از آن، تا تمدید نکنی، در جست‌وجو دیده نمی‌شوی و نوبت آنلاین نمی‌گیری.`,
      sms: { key: "billing_ended", values: { days: toPersianDigits(graceDays) } }
    };
  }
  return {
    title: "حسابت از جست‌وجو کنار رفت",
    body: "نوبت‌ها، مشتری‌ها و عکس‌هایت سر جایشان است. با خرید اشتراک، همه‌چیز همان لحظه برمی‌گردد.",
    sms: { key: "billing_closed", values: { since: formatPersianShortDate(access.graceEndsAt) } }
  };
}
