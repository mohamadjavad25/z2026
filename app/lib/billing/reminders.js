import { DAY_MS } from "./period.js";
import { TRIAL_SOON_DAYS } from "./plans.js";
import { toPersianDigits } from "../../shared/lib/digits.js";
import { formatPersianLongDate, formatPersianShortDate } from "../../shared/lib/billingFormat.js";

/**
 * Which subscription reminder is due for an account right now, and its words. Pure, so the timing is unit-tested
 * (tests/unit/billingReminders.test.js); the cron claims each (account, kind, end date) once before sending.
 *
 *   ends_5d  five days or fewer left of a paid period; two or fewer of the 7 free days (day 5)
 *   ends_1d  less than a day left (the last free day)
 *   ended    access ended, grace days running: everything still works
 *   closed   grace over: the booking link is off and no new bookings by hand (only within a week of closing, not forever)
 */
export const CLOSED_NOTICE_WINDOW_DAYS = 7;

export function reminderKind(access, now = new Date()) {
  if (access.state === "trial" || access.state === "active") {
    if (access.daysLeft <= 1) return "ends_1d";
    if (access.daysLeft <= (access.state === "trial" ? TRIAL_SOON_DAYS : 5)) return "ends_5d";
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
  const what = access.state === "trial" ? "دوره‌ی رایگانت" : "اشتراکت";
  if (kind === "ends_5d") {
    return {
      title: access.state === "trial" ? "دوره‌ی رایگانت داره تموم می‌شه" : "اشتراکت داره تموم می‌شه",
      body: `${what} ${toPersianDigits(access.daysLeft)} روز دیگه، ${until}، تموم می‌شه. برای اینکه لینک نوبتت خاموش نشه، از تنظیمات اشتراک بخر.`,
      sms: { key: "billing_reminder", values: { days: toPersianDigits(access.daysLeft), until: untilShort } }
    };
  }
  if (kind === "ends_1d") {
    return {
      title: "کمتر از یه روز مونده",
      body: `${what} ${until} تموم می‌شه. از تنظیمات اشتراک بخر تا لینک نوبتت خاموش نشه.`,
      sms: { key: "billing_reminder", values: { days: toPersianDigits(1), until: untilShort } }
    };
  }
  if (kind === "ended") {
    return {
      title: "اشتراکت تموم شد",
      body: `تا ${toPersianDigits(graceDays)} روز دیگه همه‌چی کار می‌کنه؛ بعدش تا تمدید نکنی، لینک نوبتت خاموش می‌شه و نوبت تازه نمی‌تونی بذاری.`,
      sms: { key: "billing_ended", values: { days: toPersianDigits(graceDays) } }
    };
  }
  return {
    title: "لینک نوبتت خاموش شد",
    body: "نوبت تازه نمی‌گیری و نمی‌تونی بذاری. نوبت‌های قبلی، مشتری‌ها و عکس‌هات سر جاشونه؛ اشتراک بخری، همه‌چی همون لحظه برمی‌گرده.",
    sms: { key: "billing_closed", values: { since: formatPersianShortDate(access.graceEndsAt) } }
  };
}
