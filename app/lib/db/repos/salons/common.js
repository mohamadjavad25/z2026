import { getDb } from "../../connection.js";

export const defaultHours = [
  { day: "شنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: 1 },
  { day: "یکشنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: 1 },
  { day: "دوشنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: 1 },
  { day: "سه‌شنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: 1 },
  { day: "چهارشنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: 1 },
  { day: "پنجشنبه", open_time: "۱۰:۰۰", close_time: "۱۸:۰۰", capacity: 5, active: 1 },
  { day: "جمعه", open_time: "", close_time: "", capacity: 0, active: 0 }
];

export function toAsciiDigits(value) {
  return String(value ?? "").replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

export function normalizePhone(phone) {
  return toAsciiDigits(phone).replace(/[^\d+]/g, "").trim();
}

export function countFollowing(userId) {
  const row = getDb().prepare("SELECT COUNT(*) AS c FROM follows WHERE follower_user_id = ?").get(userId);
  return Number(row?.c || 0);
}
