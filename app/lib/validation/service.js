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
  if (typeof value !== "string" && typeof value !== "number") return "قیمت نامعتبر است.";
  const text = String(value).trim();
  if (text.length > SERVICE_LIMITS.price) return "متن قیمت خیلی بلند است.";
  const ascii = toAsciiDigits(text);
  if (/^[-−–]\s*\d/.test(ascii)) return "قیمت نمی‌تواند منفی باشد.";
  // Only digits and thousands separators: a plain amount.
  if (/^[\d\s,٬.،]+$/.test(ascii) && /\d/.test(ascii)) {
    if (/\.\d/.test(ascii) && !/^\d{1,3}(\.\d{3})+$/.test(ascii.trim())) return "قیمت را به‌صورت عدد صحیح (تومان) بنویس.";
    const parsed = parseBoundedInt(ascii.replace(/[\s,٬.،]/g, ""), { min: 0, max: SERVICE_LIMITS.maxPriceToman });
    if (!parsed.ok) return "قیمت نامعتبر یا بیش از حد بزرگ است.";
  }
  return null;
}

/**
 * A service's duration is shown as text ("۴۵ دقیقه"); the number in it is what bookings use, so it must be
 * a whole number of minutes from 1 to MAX_BOOKING_MINUTES. An empty one is allowed (the default applies).
 */
export function durationProblem(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number") return "مدت نامعتبر است.";
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > SERVICE_LIMITS.duration) return "متن مدت خیلی بلند است.";
  const match = toAsciiDigits(text).match(/\d+/);
  if (!match || match[0].length > 6) return "مدت خدمت را به دقیقه و با عدد بنویس؛ مثلاً ۴۵ دقیقه.";
  if (/^\s*[-−–]/.test(toAsciiDigits(text))) return "مدت نمی‌تواند منفی باشد.";
  if (!parseBoundedInt(match[0], { min: 1, max: MAX_BOOKING_MINUTES }).ok) {
    return `مدت خدمت باید بین ۱ تا ${MAX_BOOKING_MINUTES} دقیقه باشد.`;
  }
  return null;
}

/** The first problem with the name / price / duration / hint of a service body being saved, or null. */
export function serviceFieldsProblem(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "اطلاعات خدمت نامعتبر است.";
  if (body.name !== undefined && (typeof body.name !== "string" || body.name.length > SERVICE_LIMITS.name)) {
    return "نام خدمت نامعتبر یا خیلی بلند است.";
  }
  if (body.hint !== undefined && body.hint !== null && (typeof body.hint !== "string" || body.hint.length > SERVICE_LIMITS.hint)) {
    return "توضیح خدمت نامعتبر یا خیلی بلند است.";
  }
  return priceProblem(body.price) || durationProblem(body.duration);
}
