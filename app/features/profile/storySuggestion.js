import { minutesUntilSlotStart } from "../../shared/lib/bookingWindow.js";
import { toAsciiDigits, toPersianDigits } from "../../shared/lib/digits.js";
import { getTehranClockMinutes, timeLabelToMinutes } from "../../shared/lib/time.js";

/**
 * What the calm story card on an owner's home should say right now (owner's request 2026-10-31). Pure: the card feeds
 * it what it knows and shows the answer, so every rule below is tested without a screen.
 *
 * - `days`: free times for today and tomorrow, as loadFreeSlots gives them ({ label, key, times }).
 * - `cancelled`: bookings the list itself marks as cancelled ({ booking_date, time, staff }).
 * - `vanished`: bookings that were on the list when the owner last looked and are gone now ({ key, time, staff }).
 *   A booking cancelled while the app was closed, or by an artist's client, is found this way.
 * - `posted`: the "key|time" entries already put on a story made today.
 *
 * A time counts as freed only when it is free right now, so a time somebody booked again never shows. A freed time
 * that is already on today's story shows nothing: the audience already knows about it.
 */

/** "8:5" → null, "8:05" and "۰۸:۰۵" → "08:05". */
export function clock(value) {
  const match = toAsciiDigits(String(value || "")).match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
}

export function slotKey(dayKey, time) {
  return `${dayKey}|${clock(time)}`;
}

/** Minutes from now to a free time today or tomorrow (tomorrow: through midnight, plus the time). */
export function minutesLeft(day, now) {
  return (time) => {
    const today = minutesUntilSlotStart(day.key, time, now);
    if (Number.isFinite(today)) return today;
    return day.label === "امروز" ? today : 24 * 60 - getTehranClockMinutes(now) + timeLabelToMinutes(time);
  };
}

/** «۳ ساعت و ۱۰ دقیقه» / «۴۵ دقیقه» / «۲ ساعت» */
export function formatLeft(minutes) {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${toPersianDigits(rest)} دقیقه`;
  return rest ? `${toPersianDigits(hours)} ساعت و ${toPersianDigits(rest)} دقیقه` : `${toPersianDigits(hours)} ساعت`;
}

/** How much a story is still worth at a glance: plenty of time, getting short, or nearly too late. */
export function toneFor(minutes) {
  if (minutes >= 180) return "ok";
  if (minutes >= 60) return "soon";
  return "late";
}

export function buildSuggestion({ days = [], cancelled = [], vanished = [], posted = [], now = new Date() }) {
  const postedSet = new Set(posted);
  const entries = [];
  for (const day of days) {
    const left = minutesLeft(day, now);
    for (const time of day.times || []) {
      const t = clock(time);
      if (t) entries.push({ key: slotKey(day.key, t), dayKey: day.key, today: day.label === "امروز", time: t, left: left(t) });
    }
  }
  if (!entries.length) return null;
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));

  const freed = [];
  const seen = new Set();
  const add = (dayKey, time, staff, wasCancelled) => {
    const key = slotKey(dayKey, time);
    const entry = byKey.get(key);
    if (!entry || seen.has(key)) return;
    seen.add(key);
    freed.push({ ...entry, staff: String(staff || "").trim(), wasCancelled });
  };
  for (const booking of cancelled) {
    if (booking?.status === "لغو") add(booking.booking_date, booking.time, booking.staff, true);
  }
  // Gone from the list without the list saying why: cancelled elsewhere, or moved. «آزاد شد» is true either way.
  for (const booking of vanished) add(booking.key, booking.time, booking.staff, false);

  const freshFreed = freed.filter((entry) => !postedSet.has(entry.key)).sort((a, b) => a.left - b.left);
  if (freshFreed.length) {
    const first = freshFreed[0];
    const when = `${first.today ? "" : "فردا "}ساعت ${toPersianDigits(first.time)}`;
    const verb = freshFreed.every((entry) => entry.wasCancelled) ? "لغو شد" : "آزاد شد";
    // Only the first name of a team member: the title has to fit one line on a phone.
    const who = first.staff ? first.staff.split(/\s+/)[0] : "";
    const title = freshFreed.length === 1
      ? `${who ? `نوبت ${who} ` : "نوبت "}${when} ${verb}`
      : `${toPersianDigits(freshFreed.length)} وقت ${verb}`;
    return { kind: "freed", title, left: first.left, tone: first.today ? toneFor(first.left) : "ok", keys: freshFreed.map((entry) => entry.key) };
  }

  const fresh = entries.filter((entry) => !postedSet.has(entry.key));
  if (!fresh.length) return null;
  const todayFresh = fresh.filter((entry) => entry.today);
  const postedAny = entries.length > fresh.length || posted.length > 0;
  const lead = todayFresh.length ? todayFresh : fresh;
  const soonest = [...lead].sort((a, b) => a.left - b.left)[0];
  const where = todayFresh.length ? "امروز" : "فردا";
  const title = postedAny
    ? `${toPersianDigits(lead.length)} وقت تازه خالی شد که توی استوری قبلیت نبود`
    : `${where} ${toPersianDigits(lead.length)} وقت خالی داری`;
  return { kind: postedAny ? "new" : "free", title, left: soonest.left, tone: todayFresh.length ? toneFor(soonest.left) : "ok", keys: fresh.map((entry) => entry.key) };
}
