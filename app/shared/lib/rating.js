import { toLatinDigits, toPersianDigits } from "./digits.js";

export function parseNumericRating(value) {
  const normalized = toLatinDigits(String(value ?? "")).replace(/[^\d.]/g, "");
  const rating = Number(normalized);
  return Number.isFinite(rating) ? rating : 0;
}

export function formatRating(value) {
  const rating = Math.round((Number(value) || 0) * 10) / 10;
  return toPersianDigits(rating.toLocaleString("en-US", { maximumFractionDigits: 1 }));
}

export function formatCount(value) {
  const num = Number(value) || 0;
  if (num >= 1000) {
    const scaled = num / 1000;
    const text = Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1).replace(/\.0$/, "");
    return toPersianDigits(`${text}k`);
  }
  return toPersianDigits(String(num));
}
