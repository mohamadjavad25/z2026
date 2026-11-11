import { toAsciiDigits, toLatinDigits, toPersianDigits } from "./digits.js";
import { nowDate, nowMs } from "./clock.js";

export const PUBLIC_BOOKING_DAY_START = 9 * 60;
export const PUBLIC_BOOKING_DAY_END = 21 * 60;
export const PUBLIC_BOOKING_SLOT_STEP = 30;

/**
 * The booking day strip, from today in Iran. The labels are read back by their weekday name, so a list starting on the
 * phone's own day (another country's clock) made «جمعه ۱۵ آبان» mean the Friday after it. Whole days of milliseconds stay
 * right because Iran has no daylight saving.
 */
export function buildUpcomingWeekDays(count = 7) {
  const weekdayFmt = new Intl.DateTimeFormat("fa-IR", { weekday: "long", timeZone: "Asia/Tehran" });
  const dayFmt = new Intl.DateTimeFormat("fa-IR", { day: "numeric", timeZone: "Asia/Tehran" });
  const monthFmt = new Intl.DateTimeFormat("fa-IR", { month: "long", timeZone: "Asia/Tehran" });
  const now = nowMs();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now + index * 24 * 60 * 60 * 1000);
    return `${weekdayFmt.format(date)} ${dayFmt.format(date)} ${monthFmt.format(date)}`;
  });
}

/**
 * The minutes a service's written length says: «۴۵ دقیقه», «۴۵», «۲ ساعت», «۱ ساعت و نیم», «۲ ساعت و ۳۰ دقیقه», «نیم ساعت»,
 * «۱:۳۰». 0 when it says none. A range («۱ تا ۲ ساعت») counts as its longer end, so a calendar never holds too little.
 */
const NUMBER_WORDS = { "یک": 1, "یه": 1, "دو": 2, "سه": 3, "چهار": 4, "پنج": 5, "شش": 6, "هفت": 7, "هشت": 8, "ده": 10, "پونزده": 15, "پانزده": 15, "بیست": 20, "سی": 30, "چهل": 40, "پنجاه": 50 };
const WORD = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join("|");
const TENS_AND_ONES = new RegExp(`(بیست|سی|چهل|پنجاه)\\s*و\\s*(${WORD})\\s*(?=ساعت|دقیقه)`, "g");
const NUMBER_WORD = new RegExp(`(?<![\\u0600-\\u06FF])(${WORD})\\s*(?=ساعت|دقیقه)`, "g");

/** «دو ساعت» → «2 ساعت», «چهل و پنج دقیقه» → «45 دقیقه»; a bug of 2026-11-09 counted the first as one hour. */
function wordsToNumbers(text) {
  return text
    .replace(/\u200c/g, " ")
    .replace(TENS_AND_ONES, (_, tens, ones) => `${NUMBER_WORDS[tens] + NUMBER_WORDS[ones]} `)
    .replace(NUMBER_WORD, (_, word) => `${NUMBER_WORDS[word]} `);
}

export function durationTextMinutes(value) {
  const text = wordsToNumbers(toAsciiDigits(String(value ?? "")).replace(/٫/g, ".").trim());
  const clock = text.match(/^(\d{1,2}):(\d{2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  if (!/ساعت/.test(text)) return Number(text.match(/\d+/)?.[0] || 0);
  const hours = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?=ساعت)/g)].at(-1)?.[1];
  const base = hours ? Number(hours) * 60 : /نیم\s*ساعت/.test(text) ? 30 : /ربع\s*ساعت/.test(text) ? 15 : 60;
  const extra = Number(text.match(/(\d+)\s*دقیقه/)?.[1] || 0) + (/و\s*نیم/.test(text) ? 30 : 0) + (/و\s*ربع/.test(text) ? 15 : 0);
  return Math.round(base + extra);
}

export function parseServiceDurationMinutes(value) {
  return Math.max(15, durationTextMinutes(value) || 60);
}

export function timeLabelToMinutes(value) {
  const [hours = "0", minutes = "0"] = toLatinDigits(value).split(":");
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
}

/** Canonical booking clock label for DB storage/compare (Latin digits, HH:MM). */
export function normalizeBookingTimeLabel(value) {
  const total = timeLabelToMinutes(value);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * The strict reading of a clock time typed or sent by a person: "H:MM" or "HH:MM" in Persian, Arabic-Indic
 * or Latin digits, hour 0-23, minute 0-59. → canonical "HH:MM", or "" for anything else ("24:00", "10:60",
 * "11:00:00", "11", "1100", text, numbers). normalizeBookingTimeLabel above is the forgiving one for stored data.
 */
export function parseBookingTime(value) {
  if (typeof value !== "string") return "";
  const match = toAsciiDigits(value.trim()).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return "";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** A closing time: like parseBookingTime, and also "24:00" (open until midnight). A visit can never start at 24:00. */
export function parseClosingTime(value) {
  if (typeof value === "string" && /^0*24:0{2}$/.test(toAsciiDigits(value.trim()))) return "24:00";
  return parseBookingTime(value);
}

export function minutesToPersianTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return toPersianDigits(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
}

export function buildClockOptions(
  fromMinutes = PUBLIC_BOOKING_DAY_START,
  toMinutes = PUBLIC_BOOKING_DAY_END,
  step = PUBLIC_BOOKING_SLOT_STEP
) {
  const slots = [];
  for (let cursor = fromMinutes; cursor <= toMinutes; cursor += step) {
    slots.push(minutesToPersianTime(cursor));
  }
  return slots;
}

export function buildPublicBookingSlots(durationMinutes) {
  const duration = Math.max(15, Number(durationMinutes) || 60);
  const slots = [];
  for (
    let cursor = PUBLIC_BOOKING_DAY_START;
    cursor + duration <= PUBLIC_BOOKING_DAY_END;
    cursor += PUBLIC_BOOKING_SLOT_STEP
  ) {
    slots.push(minutesToPersianTime(cursor));
  }
  return slots;
}

export function buildDayBookingSlots(openTime, closeTime, durationMinutes) {
  const open = timeLabelToMinutes(openTime || "۰۹:۰۰");
  const close = timeLabelToMinutes(closeTime || "۲۱:۰۰");
  const duration = Math.max(15, Number(durationMinutes) || 60);
  if (!(close > open)) return buildPublicBookingSlots(duration);

  const slots = [];
  for (let cursor = open; cursor + duration <= close; cursor += PUBLIC_BOOKING_SLOT_STEP) {
    slots.push(minutesToPersianTime(cursor));
  }
  return slots;
}

export function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

const WEEKDAY_ROW_NAMES = { Sat: "شنبه", Sun: "یکشنبه", Mon: "دوشنبه", Tue: "سه‌شنبه", Wed: "چهارشنبه", Thu: "پنجشنبه", Fri: "جمعه" };
const tehranWeekdayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Tehran" });

/**
 * Today's name in Iran, spelled as the hours rows store it. Never `getDay()` for this: that is the device's own clock, so
 * a phone set to another country's time gets another «امروز» than the server's page (error report of 2026-11-07).
 */
export function getTodayPersianWeekday(date = nowDate()) {
  return WEEKDAY_ROW_NAMES[tehranWeekdayFmt.format(date)];
}

/** Minutes since midnight in Iran time — booking slots are stored as local Iran clocks. */
export function getTehranClockMinutes(date = nowDate()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const hourRaw = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  const hour = hourRaw === 24 ? 0 : hourRaw;
  return hour * 60 + minute;
}

// Owner's decision of 2026-11-08: working hours run from 6:00 to 24:00. 24:00 is only ever a closing time.
export const SALON_HOUR_TIME_OPTIONS = buildClockOptions(6 * 60, 24 * 60, 60);

/** Normalizes a row's created_at/updated_at into something `new Date()`/
 *  `Date.parse()` parses as UTC. Handles both shapes this codebase's API
 *  responses have used: a real ISO 8601 string (already has "T" and a
 *  trailing offset/"Z" — native TIMESTAMPTZ, JSON-serialized from a JS
 *  Date, passed through unchanged) and the older bare
 *  "YYYY-MM-DD HH:MM:SS" text-timestamp shape with no offset marker, which
 *  JS would otherwise silently parse as local time instead of UTC. */
export function toIsoLikeTimestamp(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
}
