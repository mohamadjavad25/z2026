import { toLatinDigits, toPersianDigits } from "./digits";

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
