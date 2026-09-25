import { toPersianDigits } from "./digits.js";

export function formatCount(value) {
  const num = Number(value) || 0;
  if (num >= 1000) {
    const scaled = num / 1000;
    const text = Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1).replace(/\.0$/, "");
    return toPersianDigits(`${text}k`);
  }
  return toPersianDigits(String(num));
}
