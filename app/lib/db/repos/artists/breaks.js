/** An artist's break: the daily window on its weekdays, and today's «الان استراحت می‌کنم». */
import { getDb, get, run } from "../../connection.js";
import { formatPersianDateKey } from "../../../../shared/lib/persianCalendar.js";
import { getTehranClockMinutes, timeLabelToMinutes } from "../../../../shared/lib/time.js";
import { ALL_BREAK_DAYS, BREAK_NOW_MINUTES, cleanBreakDays } from "../../../../shared/lib/artistBreak.js";

/**
 * The artist's break in the shape every reader shares (shared/lib/artistBreak.js): the daily window, the weekdays
 * it holds on, and today's «الان استراحت می‌کنم». null when there is neither a window nor a «now» break for today.
 */
export async function getArtistBreak(userId, runner = null) {
  const db = runner || (await getDb());
  const row = await get(db, `
    SELECT start_time, end_time, days, now_date, now_start, now_end FROM artist_breaks WHERE user_id = $1
  `, [userId]);
  if (!row) return null;
  const daily = row.start_time && row.end_time ? { start: row.start_time, end: row.end_time } : { start: "", end: "" };
  const now = row.now_date === formatPersianDateKey(new Date()) && row.now_start && row.now_end
    ? { date: row.now_date, start: row.now_start, end: row.now_end }
    : null;
  if (!daily.start && !now) return null;
  return { ...daily, days: cleanBreakDays(row.days ?? "0123456"), now };
}

/** The daily window and its weekdays. An empty start or end takes the window away (a «now» break stays). */
export async function setArtistBreak(userId, startTime, endTime, days = ALL_BREAK_DAYS) {
  const db = await getDb();
  const start = String(startTime || "").trim();
  const end = String(endTime || "").trim();
  if (!start || !end) return clearArtistBreak(userId);
  const startMinutes = timeLabelToMinutes(start);
  const endMinutes = timeLabelToMinutes(end);
  if (!(endMinutes > startMinutes)) {
    return { ok: false, error: "آخر استراحت باید بعد از اولش باشه." };
  }
  const dayList = cleanBreakDays(days);
  if (!dayList.length) return { ok: false, error: "دست‌کم یه روز رو روشن بذار، یا استراحت رو پاک کن." };
  await run(db, `
    INSERT INTO artist_breaks (user_id, start_time, end_time, days, updated_at)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      days = excluded.days,
      updated_at = CURRENT_TIMESTAMP
  `, [userId, start, end, dayList.join("")]);
  return { ok: true, break: await getArtistBreak(userId, db) };
}

/** Takes the daily window away; today's «now» break, if any, stays. */
export async function clearArtistBreak(userId) {
  const db = await getDb();
  await run(db, "UPDATE artist_breaks SET start_time = '', end_time = '', days = '0123456', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1", [userId]);
  await run(db, "DELETE FROM artist_breaks WHERE user_id = $1 AND start_time = '' AND (now_date = '' OR now_date <> $2)", [userId, formatPersianDateKey(new Date())]);
  return { ok: true, break: await getArtistBreak(userId, db) };
}

/**
 * «الان استراحت می‌کنم»: from this minute (Tehran) for `minutes` (15, 30 or 60), today only, ending by midnight.
 * 0 ends it now. Bookings already inside it stay (owner's decision 2026-11-02); only new ones are kept out.
 */
export async function setArtistBreakNow(userId, minutes, now = new Date()) {
  const db = await getDb();
  const length = Number(minutes) || 0;
  if (length && !BREAK_NOW_MINUTES.includes(length)) return { ok: false, error: "۱۵، ۳۰ یا ۶۰ دقیقه رو انتخاب کن." };
  const today = formatPersianDateKey(now);
  if (!length) {
    await run(db, "UPDATE artist_breaks SET now_date = '', now_start = '', now_end = '', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1", [userId]);
    await run(db, "DELETE FROM artist_breaks WHERE user_id = $1 AND start_time = ''", [userId]);
    return { ok: true, break: await getArtistBreak(userId, db) };
  }
  const from = getTehranClockMinutes(now);
  const to = Math.min(from + length, 24 * 60 - 1);
  const clock = (value) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  await run(db, `
    INSERT INTO artist_breaks (user_id, now_date, now_start, now_end, updated_at)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      now_date = excluded.now_date,
      now_start = excluded.now_start,
      now_end = excluded.now_end,
      updated_at = CURRENT_TIMESTAMP
  `, [userId, today, clock(from), clock(to)]);
  return { ok: true, break: await getArtistBreak(userId, db) };
}
