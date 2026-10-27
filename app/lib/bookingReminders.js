import { getDb, all, get } from "./db/connection.js";
import { sendPushToUser } from "./push.js";
import { smsBookingReminder } from "./bookingSms.js";
import { bookingStartMs, dueReminderKind } from "../shared/lib/reminderTiming.js";
import { formatPersianDateKey } from "../shared/lib/persianCalendar.js";
import { formatRelativeBookingDayLabel } from "../shared/lib/persianCalendar.js";
import { toPersianDigits } from "../shared/lib/digits.js";

/**
 * Appointment reminders for CLIENTS: one push about a day before and one about two hours before
 * every confirmed booking. Runs from an external scheduler (see /api/cron/send-reminders and
 * .github/workflows/cron-booking-reminders.yml), like the expiry sweep.
 *
 * - Respects the client's own "reminders" setting (default on).
 * - Claims a (booking, kind) row BEFORE sending, so overlapping sweeps can't double-send. The claimed kind carries
 *   the booking's date and time ("day@1405-08-03 15:00"), so a booking moved to a new time is reminded again for it.
 * - Only confirmed bookings: cancelled, expired and still-pending requests never get one.
 * - A few at a time (one slow phone no longer holds up everyone after it), and each push only waits for a phone
 *   that is off until the appointment starts: a reminder after the visit is worse than none.
 * - The day-before reminder waits out the night (22:00 to 08:00 Tehran): a visit confirmed at 1 a.m. for the next
 *   evening is reminded in the morning, not straight after the "confirmed" news. The two-hour one always goes, and
 *   someone no push reached (no app, no browser notifications: most iPhones) gets it as an SMS (booking_reminder).
 */
const CONFIRMED = "تایید شده";
const PARALLEL = 10;
const QUIET_FROM = 22 * 60;
const QUIET_UNTIL = 8 * 60;
const TEHRAN_OFFSET_MINUTES = 3 * 60 + 30;

/** True between 22:00 and 08:00 in Tehran (no daylight saving), whatever the server's own clock zone. */
export function tehranNight(now) {
  const minutes = (((now.getUTCHours() * 60 + now.getUTCMinutes() + TEHRAN_OFFSET_MINUTES) % 1440) + 1440) % 1440;
  return minutes >= QUIET_FROM || minutes < QUIET_UNTIL;
}

/** What booking_reminders.kind holds for one reminder: "day" or "soon", and the time it was for. */
export const reminderClaimKind = (kind, booking) => `${kind}@${booking.booking_date} ${booking.time}`;

async function loadCandidates(db, now) {
  // Date keys are zero-padded "YYYY-MM-DD", so text comparison orders them correctly.
  const today = formatPersianDateKey(now);
  const dayAfter = formatPersianDateKey(new Date(now.getTime() + 3 * 24 * 3600 * 1000));
  const salon = await all(db, `
    SELECT 'salon' AS source, b.id, b.client_user_id, b.salon_user_id AS owner_user_id, b.booking_date, b.time, b.service, u.name AS place
    FROM salon_bookings b JOIN users u ON u.id = b.salon_user_id
    WHERE b.status = $1 AND b.client_user_id IS NOT NULL AND b.booking_date >= $2 AND b.booking_date <= $3
  `, [CONFIRMED, today, dayAfter]);
  const artist = await all(db, `
    SELECT 'artist' AS source, b.id, b.client_user_id, b.artist_user_id AS owner_user_id, b.booking_date, b.time, b.service, u.name AS place
    FROM artist_bookings b JOIN users u ON u.id = b.artist_user_id
    WHERE b.status = $1 AND b.client_user_id IS NOT NULL AND b.source_salon_user_id IS NULL
      AND b.booking_date >= $2 AND b.booking_date <= $3
  `, [CONFIRMED, today, dayAfter]);
  return [...salon, ...artist];
}

/** The client can opt out (تنظیمات → یادآوری نوبت); a salon/artist can switch reminders off for their customers. */
async function remindersEnabled(db, booking) {
  const rows = await all(db, "SELECT user_id, settings FROM user_settings WHERE user_id = ANY($1::int[])", [[Number(booking.client_user_id), Number(booking.owner_user_id)]]);
  const settingsOf = (id) => rows.find((row) => Number(row.user_id) === Number(id))?.settings || {};
  const client = settingsOf(booking.client_user_id);
  const owner = settingsOf(booking.owner_user_id);
  return client.reminders !== false && owner.reminders !== false;
}

export function reminderMessage(kind, booking, now) {
  const time = toPersianDigits(String(booking.time || ""));
  const where = booking.place ? ` — ${booking.place}` : "";
  const what = booking.service || "نوبت";
  if (kind === "soon") {
    return { title: "نوبتت نزدیکه", body: `${what}${where} ساعت ${time}؛ کمتر از ۲ ساعت دیگه.` };
  }
  // «میای؟» (owner's decision of 2026-10-27): the day-before reminder asks; the answer buttons are on the booking card.
  const day = formatRelativeBookingDayLabel(booking.booking_date, now);
  return { title: `${day} ساعت ${time} میای؟`, body: `${what}${where}. بزن و بگو میای یا نه، تا خیالشون راحت باشه.` };
}

export async function sweepBookingReminders(now = new Date()) {
  const db = await getDb();
  const result = { candidates: 0, claimed: 0, sent: 0, skipped: 0 };
  const due = [];
  const night = tehranNight(now);
  for (const booking of await loadCandidates(db, now)) {
    const kind = dueReminderKind(booking.booking_date, booking.time, now);
    if (kind === "day" && night) continue;
    if (kind) due.push({ booking, kind });
  }
  result.candidates = due.length;
  const remind = async ({ booking, kind }) => {
    if (!(await remindersEnabled(db, booking))) {
      result.skipped += 1;
      return;
    }
    // A bare "day"/"soon" row is from before the claim carried the time: it still counts, so nobody is reminded twice.
    const claim = await get(db, `
      INSERT INTO booking_reminders (source, booking_id, kind)
      SELECT $1::text, $2::int, $3::text WHERE NOT EXISTS (SELECT 1 FROM booking_reminders WHERE source = $1::text AND booking_id = $2::int AND kind = $4::text)
      ON CONFLICT DO NOTHING RETURNING booking_id
    `, [booking.source, booking.id, reminderClaimKind(kind, booking), kind]);
    if (!claim) return;
    result.claimed += 1;
    const message = reminderMessage(kind, booking, now);
    const ttl = (bookingStartMs(booking.booking_date, booking.time, now) - now.getTime()) / 1000;
    const push = await sendPushToUser(booking.client_user_id, { ...message, url: "/", ttl }).catch(() => ({ sent: 0 }));
    result.sent += push.sent || 0;
    if (kind === "soon") smsBookingReminder(booking.client_user_id, { providerName: booking.place, time: booking.time }, push);
  };
  let next = 0;
  const worker = async () => {
    while (next < due.length) {
      const item = due[next];
      next += 1;
      await remind(item).catch(() => {});
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, due.length) }, worker));
  return result;
}
