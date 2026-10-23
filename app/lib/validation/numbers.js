import { toAsciiDigits } from "../../shared/lib/digits.js";

/**
 * A whole number sent as a number or as digits in text (Persian, Arabic-Indic or Latin digits, optional
 * surrounding space), within [min, max]. Never a guess: NaN, Infinity, fractions, negatives, "12abc",
 * "1e3", "0x10", arrays and objects are all refused.
 * → { ok: true, value } or { ok: false }.
 */
export function parseBoundedInt(value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  let number;
  if (typeof value === "number") number = value;
  else if (typeof value === "string" && /^\s*\d{1,15}\s*$/.test(toAsciiDigits(value))) number = Number(toAsciiDigits(value).trim());
  else return { ok: false };
  if (!Number.isSafeInteger(number) || number < min || number > max) return { ok: false };
  return { ok: true, value: number };
}

/** The longest and shortest appointment anyone may book, in minutes (the booking screens already work in 15-minute steps). */
export const MIN_BOOKING_MINUTES = 15;
export const MAX_BOOKING_MINUTES = 720;

/**
 * The appointment length a caller sent (`durationMinutes` / `duration_minutes`, or the text `duration` like
 * "۴۵ دقیقه"). Not sent (missing, null, "", 0) → { ok: true, minutes: undefined } so the service's own length applies.
 * Sent but not a whole positive number of minutes (text, NaN, negative, fraction) → { ok: false } (callers answer 400).
 * Under MIN_BOOKING_MINUTES is raised to it and over MAX_BOOKING_MINUTES cut to it, as before.
 */
export function parseRequestedMinutes(source) {
  for (const key of ["durationMinutes", "duration_minutes"]) {
    const raw = source?.[key];
    if (raw === undefined || raw === null || raw === "" || raw === 0 || raw === "0") continue;
    const parsed = parseBoundedInt(raw, { min: 1 });
    if (!parsed.ok) return { ok: false };
    return { ok: true, minutes: Math.min(MAX_BOOKING_MINUTES, Math.max(MIN_BOOKING_MINUTES, parsed.value)) };
  }
  return { ok: true, minutes: undefined };
}
