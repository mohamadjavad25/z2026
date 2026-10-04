import { toLatinDigits, toPersianDigits } from "./digits.js";

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

