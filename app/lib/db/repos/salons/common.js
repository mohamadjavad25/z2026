import { getDb, get } from "../../connection.js";

export const defaultHours = [
  { day: "شنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: true },
  { day: "یکشنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: true },
  { day: "دوشنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: true },
  { day: "سه‌شنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: true },
  { day: "چهارشنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: true },
  { day: "پنجشنبه", open_time: "۱۰:۰۰", close_time: "۱۸:۰۰", capacity: 5, active: true },
  { day: "جمعه", open_time: "", close_time: "", capacity: 0, active: false }
];

export { toAsciiDigits } from "../../../../shared/lib/digits.js";
// The one phone normaliser, shared with sign-up and login (see app/shared/lib/phone.js).
export { normalizePhone } from "../../../../shared/lib/phone.js";

export async function countFollowing(userId, runner = null) {
  const db = runner || (await getDb());
  const row = await get(db, "SELECT COUNT(*) AS c FROM follows WHERE follower_user_id = $1", [userId]);
  return Number(row?.c || 0);
}
