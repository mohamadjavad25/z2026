import { all, get, getDb } from "./db/connection.js";
import { sendPushToUser } from "./push.js";
import { dueRuleFor } from "./db/repos/dueReminders.js";
import { bookingStartMs } from "../shared/lib/reminderTiming.js";
import { formatPersianDateKey } from "../shared/lib/persianCalendar.js";
import { parseBookingParts } from "../shared/lib/bookingParts.js";
import { DUE_SEND_WINDOW_DAYS, dueText } from "../shared/lib/dueReminder.js";

/**
 * «وقتش شده» (owner's decisions of 2026-10-25): once the usual gap after a visit has passed, its client gets ONE push
 * («وقت ناخن شده»), whose tap opens that place's booking form on the same service. Push only, never an SMS.
 * Nothing goes when:
 *  - the place has not confirmed its gaps yet (users.due_confirmed_at), or set this service's gap to «خاموش»;
 *  - the visit was a «نیومد», or the client already has a later booking at the same place;
 *  - the client switched «یادآوری وقتش شده» off (Settings);
 *  - it is outside 10:00–20:00 Tehran (it waits for the day), or more than a week past the due day.
 * Runs with the appointment reminders (/api/cron/send-reminders).
 */
const DAY_MS = 24 * 3600 * 1000;
const LOOKBACK_DAYS = 130;
const TEHRAN_OFFSET_MINUTES = 3 * 60 + 30;
const SEND_FROM = 10 * 60;
const SEND_UNTIL = 20 * 60;

function tehranDaytime(now) {
  const minutes = (((now.getUTCHours() * 60 + now.getUTCMinutes() + TEHRAN_OFFSET_MINUTES) % 1440) + 1440) % 1440;
  return minutes >= SEND_FROM && minutes < SEND_UNTIL;
}

async function candidates(db, now) {
  const from = formatPersianDateKey(new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS));
  const until = formatPersianDateKey(now);
  const salon = await all(db, `
    SELECT 'salon' AS kind, b.id, b.client_user_id, b.salon_user_id AS owner_user_id, b.booking_date, b.time, b.service, b.parts, u.name AS place
    FROM salon_bookings b JOIN users u ON u.id = b.salon_user_id
    WHERE u.due_confirmed_at IS NOT NULL AND b.status IN ('تایید شده', 'تازه') AND b.no_show_at IS NULL
      AND b.client_user_id IS NOT NULL AND b.booking_date >= $1 AND b.booking_date <= $2
      AND NOT EXISTS (SELECT 1 FROM due_reminders_sent s WHERE s.booking_kind = 'salon' AND s.booking_id = b.id)
  `, [from, until]);
  const artist = await all(db, `
    SELECT 'artist' AS kind, b.id, b.client_user_id, b.artist_user_id AS owner_user_id, b.booking_date, b.time, b.service, '' AS parts, u.name AS place
    FROM artist_bookings b JOIN users u ON u.id = b.artist_user_id
    WHERE u.due_confirmed_at IS NOT NULL AND b.source_salon_user_id IS NULL AND b.status IN ('تایید', 'تایید شده') AND b.no_show_at IS NULL
      AND b.client_user_id IS NOT NULL AND b.booking_date >= $1 AND b.booking_date <= $2
      AND NOT EXISTS (SELECT 1 FROM due_reminders_sent s WHERE s.booking_kind = 'artist' AND s.booking_id = b.id)
  `, [from, until]);
  return [...salon, ...artist];
}

/** The first service of the visit that is due now: { service, rule } or null. */
async function dueService(db, booking, now) {
  const start = bookingStartMs(booking.booking_date, booking.time, now);
  if (start === null) return null;
  const parts = parseBookingParts(booking.parts);
  const names = parts.length ? [...new Set(parts.map((part) => part.service).filter(Boolean))] : [String(booking.service || "").trim()];
  for (const service of names.filter(Boolean)) {
    const rule = await dueRuleFor(db, booking.owner_user_id, service);
    if (!rule.gapDays) continue;
    const dueAt = start + rule.gapDays * DAY_MS;
    if (now.getTime() >= dueAt && now.getTime() < dueAt + DUE_SEND_WINDOW_DAYS * DAY_MS) return { service, rule };
  }
  return null;
}

async function hasLaterBooking(db, booking) {
  const [table, owner, extra] = booking.kind === "salon"
    ? ["salon_bookings", "salon_user_id", ""]
    : ["artist_bookings", "artist_user_id", "AND source_salon_user_id IS NULL"];
  const row = await get(db, `
    SELECT 1 FROM ${table}
    WHERE ${owner} = $1 AND client_user_id = $2 AND id <> $3 ${extra}
      AND status NOT IN ('لغو', 'منقضی شده')
      AND (booking_date > $4 OR (booking_date = $4 AND time > $5))
    LIMIT 1
  `, [booking.owner_user_id, booking.client_user_id, booking.id, booking.booking_date, booking.time]);
  return Boolean(row);
}

async function clientWantsIt(db, clientUserId) {
  const row = await get(db, "SELECT settings FROM user_settings WHERE user_id = $1", [clientUserId]);
  return row?.settings?.dueReminders !== false;
}

export async function sweepDueReminders(now = new Date()) {
  const result = { candidates: 0, sent: 0 };
  if (!tehranDaytime(now)) return result;
  const db = await getDb();
  for (const booking of await candidates(db, now)) {
    const due = await dueService(db, booking, now);
    if (!due) continue;
    result.candidates += 1;
    if (await hasLaterBooking(db, booking)) continue;
    if (!(await clientWantsIt(db, booking.client_user_id))) continue;
    const claimed = await get(db, `
      INSERT INTO due_reminders_sent (booking_kind, booking_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING booking_id
    `, [booking.kind, booking.id]);
    if (!claimed) continue;
    const query = new URLSearchParams({ open: `${booking.kind}-${booking.owner_user_id}`, s: due.service });
    await sendPushToUser(Number(booking.client_user_id), {
      title: dueText(due.rule, due.service),
      body: `${booking.place || ""}؛ بزن و یه ساعت انتخاب کن.`.trim(),
      url: `/?${query}`
    }).catch(() => {});
    result.sent += 1;
  }
  return result;
}
