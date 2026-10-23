import { toAsciiDigits } from "./digits.js";

/**
 * THE one way a phone number is turned into the form it is stored and compared in: Persian (۰-۹), Arabic-Indic
 * (٠-٩) and full-width digits become Latin 0-9, and spaces, dashes, dots, brackets and invisible direction marks
 * are dropped. Used for accounts (sign-up, login, codes), for the number a salon types for a walk-in, and
 * everywhere two numbers are compared. The database does the same in `frfro_phone_key()` (migration 045), which
 * builds salon_bookings.phone_normalized / artist_bookings.phone_normalized: keep the two in step.
 */
export const PHONE_SEPARATORS = /[\s\-(). ‌‍‎‏]/g;

export function normalizePhone(value) {
  return toAsciiDigits(value).replace(PHONE_SEPARATORS, "");
}
