import { toPersianDigits } from "./digits.js";

/**
 * «وقتش شده» (owner's decisions of 2026-10-25): the usual gap per kind of service, the three ready texts, and the
 * limits. The salon or artist confirms or changes these; the server and the screens read the same numbers from here.
 */

/** Days, by words in the service's name; the first match wins. A service none of these fits has no reminder until
 *  the salon gives it a gap. */
const USUAL_GAPS = [
  [/مژه/, 21],
  [/ناخن|مانیکور|پدیکور|لاک|ژلیش|کاشت/, 21],
  [/ابرو|میکروبلیدینگ|لیفت/, 28],
  [/اپیلاسیون|وکس|بند|لیزر/, 28],
  [/پاکسازی|فیشیال|پوست|هیدرافیشیال/, 30],
  [/رنگ|مش|لایت|بالیاژ|هایلایت|آمبره/, 56],
  [/کوتاهی|اصلاح|براشینگ|فر|کراتین|احیا|پروتئین/, 42]
];

export function usualGapDays(service) {
  const name = String(service || "");
  for (const [pattern, days] of USUAL_GAPS) if (pattern.test(name)) return days;
  return 0;
}

export const DUE_GAP_CHOICES = [0, 7, 14, 21, 28, 35, 42, 56, 70, 84];
export const DUE_CUSTOM_MAX = 80;
/** How long after the due day a reminder may still go (a sweep missed for a while sends nothing stale). */
export const DUE_SEND_WINDOW_DAYS = 7;

/** «۳ هفته» / «۱۰ روز» / «خاموش» */
export function gapLabel(days) {
  const n = Number(days) || 0;
  if (!n) return "خاموش";
  return n % 7 === 0 ? `هر ${toPersianDigits(n / 7)} هفته` : `هر ${toPersianDigits(n)} روز`;
}

export const DUE_TEXTS = [
  { id: "a", text: (service) => `وقت ${service} شده` },
  { id: "b", text: (service, days) => `${toPersianDigits(Math.max(1, Math.round((Number(days) || 21) / 7)))} هفته از ${service} گذشته؛ بیا تازه‌ش کنیم` },
  { id: "c", text: (service) => `دلمون برات تنگ شده؛ یه نوبت ${service} بگیر؟` }
];

/** The push's first line for a rule { textId, customText, gapDays } and a service name. */
export function dueText(rule, service) {
  if (rule?.textId === "custom" && String(rule.customText || "").trim()) return String(rule.customText).trim().slice(0, DUE_CUSTOM_MAX);
  const ready = DUE_TEXTS.find((item) => item.id === rule?.textId) || DUE_TEXTS[0];
  return ready.text(service, rule?.gapDays);
}
