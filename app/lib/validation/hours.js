import { parseBookingTime, timeLabelToMinutes } from "../../shared/lib/time.js";
import { toPersianDigits } from "../../shared/lib/digits.js";
import { parseBoundedInt } from "./numbers.js";

/** Most appointments a salon or artist can take in one day. */
export const MAX_DAY_CAPACITY = 1000;

/**
 * Reads one weekday's opening-hours edit (PATCH /api/salon-hours, /api/artist-hours) strictly: the day must be
 * one of the saved rows (`rows`, each { day, open_time, close_time }), times are real "HH:MM" (saved the way the
 * app already shows them, Persian digits), closing is after opening, the number of appointments a whole number from
 * 0 to MAX_DAY_CAPACITY, `active` a real true/false. → { ok: true, day, patch } or { ok: false, error }.
 */
export function readHoursPatch(body, rows) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "ساعت کاری درست نرسید؛ دوباره بزن." };
  const row = (rows || []).find((item) => item.day === body.day);
  if (typeof body.day !== "string" || !row) return { ok: false, error: "یه روز هفته انتخاب کن." };
  const patch = {};
  for (const [field, aliases] of [["openTime", ["openTime", "open_time"]], ["closeTime", ["closeTime", "close_time"]]]) {
    const key = aliases.find((alias) => body[alias] !== undefined && body[alias] !== null);
    if (!key) continue;
    const time = parseBookingTime(body[key]);
    if (!time) return { ok: false, error: "ساعت رو این‌جوری بنویس: ۱۰:۰۰" };
    patch[field] = toPersianDigits(time);
  }
  // Only a time that really changes is checked against the other one: a screen that sends the whole row back
  // (to flip the day on or off) must not be refused over times that were saved before.
  const changesTime = (patch.openTime && timeLabelToMinutes(patch.openTime) !== timeLabelToMinutes(row.open_time))
    || (patch.closeTime && timeLabelToMinutes(patch.closeTime) !== timeLabelToMinutes(row.close_time));
  if (changesTime) {
    const open = timeLabelToMinutes(patch.openTime || row.open_time);
    const close = timeLabelToMinutes(patch.closeTime || row.close_time);
    if (!(close > open)) return { ok: false, error: "ساعت بستن باید بعد از ساعت باز کردن باشه." };
  }
  if (body.capacity !== undefined && body.capacity !== null) {
    const parsed = parseBoundedInt(body.capacity, { min: 0, max: MAX_DAY_CAPACITY });
    if (!parsed.ok) return { ok: false, error: `ظرفیت یه عدد بین ۰ تا ${MAX_DAY_CAPACITY} باشه.` };
    patch.capacity = parsed.value;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") return { ok: false, error: "باز یا تعطیل بودن روز رو انتخاب کن." };
    patch.active = body.active;
  }
  return { ok: true, day: row.day, patch };
}
