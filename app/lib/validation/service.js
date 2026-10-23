import { toAsciiDigits } from "../../shared/lib/digits.js";
import { MAX_BOOKING_MINUTES, parseBoundedInt } from "./numbers.js";

/** Longest name, price text, duration text and hint a salon or artist may save on a service. */
export const SERVICE_LIMITS = { name: 120, price: 40, duration: 40, hint: 300, maxPriceToman: 10_000_000_000 };

/**
 * A service's price is free text the owner writes for people to read ("از ۶۵۰ هزار", "رایگان", "۳۵۰٬۰۰۰"), so
 * it stays text -- but it is bounded: at most SERVICE_LIMITS.price characters, never a negative figure, and a
 * plain figure (digits with separators) is a whole number of toman up to SERVICE_LIMITS.maxPriceToman.
 */
export function priceProblem(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" && typeof value !== "number") return "قیمت رو با عدد بنویس.";
  const text = String(value).trim();
  if (text.length > SERVICE_LIMITS.price) return "قیمت خیلی بلنده؛ کوتاه‌ترش کن.";
  const ascii = toAsciiDigits(text);
  if (/^[-−–]\s*\d/.test(ascii)) return "قیمت نمی‌تونه منفی باشه.";
  // Only digits and thousands separators: a plain amount.
  if (/^[\d\s,٬.،]+$/.test(ascii) && /\d/.test(ascii)) {
    if (/\.\d/.test(ascii) && !/^\d{1,3}(\.\d{3})+$/.test(ascii.trim())) return "قیمت رو به تومان و بدون اعشار بنویس.";
    const parsed = parseBoundedInt(ascii.replace(/[\s,٬.،]/g, ""), { min: 0, max: SERVICE_LIMITS.maxPriceToman });
    if (!parsed.ok) return "این قیمت خیلی بزرگه؛ دوباره نگاه کن.";
  }
  return null;
}

/**
 * A service's duration is shown as text ("۴۵ دقیقه"); the number in it is what bookings use, so it must be
 * a whole number of minutes from 1 to MAX_BOOKING_MINUTES. An empty one is allowed (the default applies).
 */
export function durationProblem(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number") return "مدت رو با عدد بنویس.";
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > SERVICE_LIMITS.duration) return "مدت خیلی بلنده؛ فقط عدد دقیقه رو بنویس.";
  const match = toAsciiDigits(text).match(/\d+/);
  if (!match || match[0].length > 6) return "مدت رو به دقیقه بنویس؛ مثلاً ۴۵";
  if (/^\s*[-−–]/.test(toAsciiDigits(text))) return "مدت نمی‌تونه منفی باشه.";
  if (!parseBoundedInt(match[0], { min: 1, max: MAX_BOOKING_MINUTES }).ok) {
    return `مدت باید بین ۱ تا ${MAX_BOOKING_MINUTES} دقیقه باشه.`;
  }
  return null;
}

/** The first problem with the name / price / duration / hint of a service body being saved, or null. */
export function serviceFieldsProblem(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "اطلاعات این کار درست نرسید؛ دوباره بزن.";
  if (body.name !== undefined && (typeof body.name !== "string" || body.name.length > SERVICE_LIMITS.name)) {
    return "اسم کار رو بنویس (خیلی بلند نباشه).";
  }
  if (body.hint !== undefined && body.hint !== null && (typeof body.hint !== "string" || body.hint.length > SERVICE_LIMITS.hint)) {
    return "توضیح خیلی بلنده؛ کوتاه‌ترش کن.";
  }
  return priceProblem(body.price) || durationProblem(body.duration);
}

/** A salon or an artist has at most this many services: they all ride on every public directory response (user's decision 2026-10-21). */
export const MAX_SERVICES_PER_PROVIDER = 100;
export const SERVICE_LIMIT_MESSAGE = "حداکثر ۱۰۰ تا کار می‌تونی داشته باشی؛ اول چند تا از قبلی‌ها رو پاک کن.";
