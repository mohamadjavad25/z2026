import { toLatinDigits } from "./digits.js";

/** Persian and Arabic-Indic digits -> ASCII. */
function toAsciiDigits(text) {
  return toLatinDigits(text).replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660));
}

/** Iranian phone in canonical 0-prefixed form ("09161234567", "06133334444"), or "" if it is not a phone. */
export function canonicalPhone(text) {
  const raw = toAsciiDigits(text).trim();
  if (!/^\+?[\d\s\-()]{7,}$/.test(raw)) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0098")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("98") && digits.length === 12) digits = `0${digits.slice(2)}`;
  else if (digits.startsWith("9") && digits.length === 10) digits = `0${digits}`;
  return /^0\d{9,10}$/.test(digits) ? digits : "";
}

/** True when the text is only digits (and + - spaces parentheses), i.e. the user is typing a phone number. */
export function looksLikePhoneInput(text) {
  const raw = toAsciiDigits(text).trim();
  return /^\+?[\d\s\-()]+$/.test(raw) && /\d/.test(raw);
}

/**
 * The full phone to search for, or "" while the number is still being typed.
 * Iranian mobiles and landlines are 11 digits with the leading 0, so a shorter
 * number (e.g. "0938615630", one digit short) is not searched yet.
 */
export function completePhone(text) {
  const phone = canonicalPhone(text);
  return phone.length === 11 ? phone : "";
}
