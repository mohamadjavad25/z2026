import { toPersianDigits } from "../../shared/lib/digits";

const relative = typeof Intl !== "undefined" && Intl.RelativeTimeFormat
  ? new Intl.RelativeTimeFormat("fa", { numeric: "auto" })
  : null;

/** "امروز" / "دیروز" / "۳ روز پیش" / "۲ هفته پیش" / "۴ ماه پیش" for an ISO date. */
export function formatPostAge(value) {
  const time = value ? new Date(value).getTime() : 0;
  if (!time) return "";
  const days = Math.floor((Date.now() - time) / 86400000);
  if (days < 0) return "";
  if (!relative) return days === 0 ? "امروز" : `${toPersianDigits(days)} روز پیش`;
  if (days < 7) return relative.format(-days, "day");
  if (days < 30) return relative.format(-Math.floor(days / 7), "week");
  if (days < 365) return relative.format(-Math.floor(days / 30), "month");
  return relative.format(-Math.floor(days / 365), "year");
}

export function postCount(value) {
  const n = Number(String(value ?? "0").replace(/[^\d]/g, ""));
  return toPersianDigits(Number.isFinite(n) ? n : 0);
}
