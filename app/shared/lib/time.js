import { toLatinDigits, toPersianDigits } from "./digits.js";

export const PUBLIC_BOOKING_DAY_START = 9 * 60;
export const PUBLIC_BOOKING_DAY_END = 21 * 60;
export const PUBLIC_BOOKING_SLOT_STEP = 30;

export function buildUpcomingWeekDays(count = 7) {
  const weekdayFmt = new Intl.DateTimeFormat("fa-IR", { weekday: "long" });
  const dayFmt = new Intl.DateTimeFormat("fa-IR", { day: "numeric" });
  const monthFmt = new Intl.DateTimeFormat("fa-IR", { month: "long" });
  const today = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return `${weekdayFmt.format(date)} ${dayFmt.format(date)} ${monthFmt.format(date)}`;
  });
}

export function parseServiceDurationMinutes(value) {
  const match = toLatinDigits(String(value ?? "")).match(/(\d+)/);
  return Math.max(15, Number(match?.[1] || 60));
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

export function getTodayPersianWeekday(date = new Date()) {
  return new Intl.DateTimeFormat("fa-IR", {
    weekday: "long",
    timeZone: "Asia/Tehran"
  }).format(date);
}

/** Minutes since midnight in Iran time — booking slots are stored as local Iran clocks. */
export function getTehranClockMinutes(date = new Date()) {
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

export function shortPersianWeekday(day) {
  const map = {
    شنبه: "ش",
    یکشنبه: "ی",
    دوشنبه: "د",
    "سه‌شنبه": "س",
    "سه شنبه": "س",
    چهارشنبه: "چ",
    پنجشنبه: "پ",
    جمعه: "ج"
  };
  return map[day] || String(day || "").slice(0, 1);
}

export const SALON_HOUR_TIME_OPTIONS = buildClockOptions(8 * 60, 23 * 60, 60);

// SQLite CURRENT_TIMESTAMP strings are UTC with no offset marker ("YYYY-MM-DD
// HH:MM:SS"); append "Z" so Date parses them as UTC instead of silently
// treating them as local time — same trick used everywhere a "respond by"
// deadline is computed from a row's created_at.
const requestExpiryDeadlineTimeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Tehran"
});

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

/** Wall-clock "HH:MM" (Persian digits, Tehran time) a pending booking
 *  request auto-expires at, given its created_at and the sweep's timeout
 *  window (60 minutes by default — see bookingExpirySweep.js). Shared single
 *  source for every "respond by" / "waiting until" deadline shown across
 *  client and owner UI (salon bookings, direct artist bookings) so none of
 *  them can drift out of sync with each other or with the sweep's own
 *  DEFAULT_TIMEOUT_MINUTES. */
export function formatRequestExpiryDeadline(createdAt, minutes = 60) {
  const isoLike = toIsoLikeTimestamp(createdAt);
  if (!isoLike) return "";
  const created = new Date(isoLike);
  if (Number.isNaN(created.getTime())) return "";
  const deadline = new Date(created.getTime() + minutes * 60 * 1000);
  return toPersianDigits(requestExpiryDeadlineTimeFmt.format(deadline));
}

/** Minutes left before a pending request's auto-expiry sweep picks it up
 *  (see formatRequestExpiryDeadline above) -- null when createdAt can't be
 *  parsed, so callers can distinguish "unknown" from "already expired"
 *  (a real, negative-but-defined number). Used to style the deadline badge
 *  as urgent once only a few minutes remain, not just show a static time. */
export function getRequestExpiryMinutesLeft(createdAt, minutes = 60) {
  const isoLike = toIsoLikeTimestamp(createdAt);
  if (!isoLike) return null;
  const created = new Date(isoLike);
  if (Number.isNaN(created.getTime())) return null;
  const deadline = created.getTime() + minutes * 60 * 1000;
  return Math.round((deadline - Date.now()) / 60000);
}
