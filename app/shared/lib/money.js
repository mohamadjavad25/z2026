import { toAsciiDigits, toLatinDigits, toPersianDigits } from "./digits.js";

export function formatToman(value) {
  return `${formatTomanNumber(value)} تومان`;
}

/** Same formatting as formatToman (Persian digits, thousands separators) but without the unit — for fields like a product's `price` display string that already sit next to their own "تومان" label. */
export function formatTomanNumber(value) {
  const num = Math.max(0, Math.floor(Number(value) || 0));
  return toPersianDigits(num.toLocaleString("en-US").replace(/,/g, "٬"));
}

/** A number field (only ever digits and separators). A service's price is free text: read that with plainPriceAmount. */
export function parseTomanAmount(value) {
  return Number(toLatinDigits(String(value ?? "")).replace(/[^\d]/g, "")) || 0;
}

const JUST_A_NUMBER = /^\d+(?:[٬,.،\s]\d{3})*$/;
const withoutUnit = (value) => toAsciiDigits(String(value ?? "")).trim().replace(/\s*(?:تومان|تومن)$/, "");

/**
 * What a service's written price is in toman when it says exactly one amount: «۴۵۰٬۰۰۰», «۴۵۰۰۰۰ تومان», «۲۵۰ هزار»,
 * «۱.۵ میلیون تومان». Anything else («از ۵۵۰ هزار», «از ۲ م», «رایگان») is 0: it has no exact amount, and taking the digits
 * out of it is how «از ۱ میلیون تومان» once read as «۱ تومان». For sums only; people read servicePriceText.
 */
export function plainPriceAmount(value) {
  const text = withoutUnit(value);
  if (JUST_A_NUMBER.test(text)) return Number(text.replace(/\D/g, "")) || 0;
  const scaled = text.match(/^(\d+(?:[.٫/]\d+)?)\s*(هزار|میلیون|ملیون)$/);
  if (!scaled) return 0;
  return Math.round(Number(scaled[1].replace(/[٫/]/, ".")) * (scaled[2] === "هزار" ? 1_000 : 1_000_000));
}

/**
 * A service's price for people to read, as its owner wrote it (owner, 2026-11-06): a bare number gets its marks
 * («۵۵۰٬۰۰۰ تومان»), words stay as they are, and a figure with no unit gets «تومان» after it («از ۵۵۰ هزار تومان»).
 */
export function servicePriceText(value) {
  const written = String(value ?? "").trim();
  if (!written) return "";
  if (JUST_A_NUMBER.test(withoutUnit(written))) {
    const amount = plainPriceAmount(written);
    return amount ? formatToman(amount) : "";
  }
  const text = toPersianDigits(written).slice(0, 40);
  return /[۰-۹]/.test(text) && !/(?:تومان|تومن)$/.test(text) ? `${text} تومان` : text;
}


const PLAIN_AMOUNT = /^[\d۰-۹٠-٩٬,.،\s]*$/;

/**
 * What a money field shows while the person types (owner, 2026-11-06): a plain number gets a mark after every three
 * digits («۴۵۰۰۰۰» → «۴۵۰٬۰۰۰») so the size is clear at a glance. Anything with words in it («از ۶۵۰ هزار») is left exactly
 * as typed, because a service price may be free text. Read the value back with parseTomanAmount.
 */
export function groupTypedAmount(value) {
  const text = String(value ?? "");
  if (!PLAIN_AMOUNT.test(text)) return text;
  const digits = toAsciiDigits(text).replace(/\D/g, "");
  if (!digits) return "";
  return toPersianDigits(digits.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, "٬"));
}
