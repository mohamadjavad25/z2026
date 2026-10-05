import { getDb, all, get } from "./db/connection.js";
import { sendPushToUser } from "./push.js";
import { dueReminderKind } from "../shared/lib/reminderTiming.js";
import { formatPersianDateKey } from "../shared/lib/persianCalendar.js";
import { formatRelativeBookingDayLabel } from "../shared/lib/persianCalendar.js";
import { toPersianDigits } from "../shared/lib/digits.js";

/**
 * Appointment reminders for CLIENTS: one push about a day before and one about two hours before
 * every confirmed booking. Runs from an external scheduler (see /api/cron/send-reminders and
 * .github/workflows/cron-booking-reminders.yml), like the expiry sweep.
 *
 * - Respects the client's own "reminders" setting (default on).
 * - Claims a (booking, kind) row BEFORE sending, so overlapping sweeps can't double-send.
 * - Only confirmed bookings: cancelled, expired and still-pending requests never get one.
 */
const CONFIRMED = "تایید شده";

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

/** The client can opt out (reminders, or booking alerts as a whole); a salon/artist can switch reminders off for their customers. */
async function remindersEnabled(db, booking) {
  const rows = await all(db, "SELECT user_id, settings FROM user_settings WHERE user_id = ANY($1::int[])", [[Number(booking.client_user_id), Number(booking.owner_user_id)]]);
  const settingsOf = (id) => rows.find((row) => Number(row.user_id) === Number(id))?.settings || {};
  const client = settingsOf(booking.client_user_id);
  const owner = settingsOf(booking.owner_user_id);
  return client.reminders !== false && client.reservationAlerts !== false && owner.reminders !== false;
}

export function reminderMessage(kind, booking, now) {
  const time = toPersianDigits(String(booking.time || ""));
  const where = booking.place ? ` — ${booking.place}` : "";
  const what = booking.service || "نوبت";
  if (kind === "soon") {
    return { title: "نوبتت نزدیکه", body: `${what}${where} ساعت ${time}؛ کمتر از ۲ ساعت دیگه.` };
  }
  const day = formatRelativeBookingDayLabel(booking.booking_date, now);
  return { title: "یادآوری نوبت", body: `${what}${where} ${day} ساعت ${time}.` };
}

export async function sweepBookingReminders(now = new Date()) {
  const db = await getDb();
  const result = { candidates: 0, claimed: 0, sent: 0, skipped: 0 };
  for (const booking of await loadCandidates(db, now)) {
    const kind = dueReminderKind(booking.booking_date, booking.time, now);
    if (!kind) continue;
    result.candidates += 1;
    if (!(await remindersEnabled(db, booking))) {
      result.skipped += 1;
      continue;
    }
    const claim = await get(db, `
      INSERT INTO booking_reminders (source, booking_id, kind) VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING RETURNING booking_id
    `, [booking.source, booking.id, kind]);
    if (!claim) continue;
    result.claimed += 1;
    const message = reminderMessage(kind, booking, now);
    const push = await sendPushToUser(booking.client_user_id, { ...message, url: "/" }).catch(() => ({ sent: 0 }));
    result.sent += push.sent || 0;
  }
  return result;
}
