import { toLatinDigits, toPersianDigits } from "./digits";

export function formatToman(value) {
  return `${formatTomanNumber(value)} تومان`;
}

/** Same formatting as formatToman (Persian digits, thousands separators) but without the unit — for fields like a product's `price` display string that already sit next to their own "تومان" label. */
export function formatTomanNumber(value) {
  const num = Math.max(0, Math.floor(Number(value) || 0));
  return toPersianDigits(num.toLocaleString("en-US"));
}

export function parseTomanAmount(value) {
  return Number(toLatinDigits(String(value ?? "")).replace(/[^\d]/g, "")) || 0;
}

export function ensureShebaIR(value) {
  const digits = String(value || "")
    .toUpperCase()
    .replace(/^IR/, "")
    .replace(/[^\d]/g, "")
    .slice(0, 24);
  return `IR${digits}`;
}

export function formatShopPrice(amount) {
  if (!amount) return "۰";
  if (amount >= 1000000) {
    const millions = amount / 1000000;
    const text = Number.isInteger(millions) ? String(millions) : millions.toFixed(1);
    return `${toPersianDigits(text.replace(".", "٫"))} م`;
  }
  return `${toPersianDigits(Math.round(amount / 1000))} ه`;
}
