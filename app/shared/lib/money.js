import { toAsciiDigits, toLatinDigits, toPersianDigits } from "./digits.js";

export function formatToman(value) {
  return `${formatTomanNumber(value)} تومان`;
}

/** Same formatting as formatToman (Persian digits, thousands separators) but without the unit — for fields like a product's `price` display string that already sit next to their own "تومان" label. */
export function formatTomanNumber(value) {
  const num = Math.max(0, Math.floor(Number(value) || 0));
  return toPersianDigits(num.toLocaleString("en-US").replace(/,/g, "٬"));
}

export function parseTomanAmount(value) {
  return Number(toLatinDigits(String(value ?? "")).replace(/[^\d]/g, "")) || 0;
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
