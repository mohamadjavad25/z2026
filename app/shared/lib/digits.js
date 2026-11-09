export const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function toPersianDigits(value) {
  return String(value ?? "").replace(/\d/g, (digit) => PERSIAN_DIGITS[digit]);
}

export function toLatinDigits(value) {
  return String(value || "")
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC_DIGITS.indexOf(digit)));
}

/** Persian, Arabic-Indic and full-width digits → Latin; every other character is left as it is. */
export function toAsciiDigits(value) {
  return toLatinDigits(String(value ?? ""))
    .replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xff10));
}
