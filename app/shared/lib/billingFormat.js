import { toPersianDigits } from "./digits.js";

/**
 * Dates on subscription screens, receipts and SMS, always in Tehran time and the Persian calendar.
 * Used on the server (SMS text) and in the app, so both say the same date.
 */
const longFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tehran" });
const shortFmt = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Tehran" });
const timeFmt = new Intl.DateTimeFormat("en-US-u-nu-latn", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tehran" });

const valid = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

/** «۲۴ آبان ۱۴۰۵» */
export function formatPersianLongDate(value) {
  const date = valid(value);
  return date ? longFmt.format(date) : "";
}

/** «۱۴۰۵/۰۹/۲۴» (no spaces: safe inside an SMS token) */
export function formatPersianShortDate(value) {
  const date = valid(value);
  if (!date) return "";
  const parts = Object.fromEntries(shortFmt.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return toPersianDigits(`${parts.year}/${parts.month}/${parts.day}`);
}

/** «۲۴ آبان ۱۴۰۵، ساعت ۱۱:۰۲» */
export function formatPersianDateTime(value) {
  const date = valid(value);
  return date ? `${formatPersianLongDate(date)}، ساعت ${toPersianDigits(timeFmt.format(date))}` : "";
}

/** «۵ روز» / «امروز» for a days-left number. */
export function formatDaysLeft(days) {
  const n = Math.max(0, Math.floor(Number(days) || 0));
  return n === 0 ? "امروز" : `${toPersianDigits(n)} روز`;
}
