export const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function toPersianDigits(value) {
  return String(value ?? "").replace(/\d/g, (digit) => PERSIAN_DIGITS[digit]);
}

export function toLatinDigits(value) {
  return String(value || "").replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)));
}
