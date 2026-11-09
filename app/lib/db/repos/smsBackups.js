import { getDb, all, get, run } from "../connection.js";

/**
 * Held booking SMS (migrations/079_sms_backups.sql): written when the Android app took the push instead, settled by
 * the 5-minute sweep (bookingSms.js sendDueSmsBackups). The newest notice for the same booking, person and template replaces an
 * older one, so a confirmed-then-cancelled booking only ever backs up its latest news.
 */

const TABLE = { salon: "salon_bookings", artist: "artist_bookings" };

/** The booking's current status, or null when it is gone. `kind` is "salon" or "artist". */
export async function bookingStatus(kind, id) {
  const table = TABLE[kind];
  if (!table || !id) return null;
  const db = await getDb();
  const row = await get(db, `SELECT status FROM ${table} WHERE id = $1`, [Number(id)]);
  return row ? String(row.status || "") : null;
}

export async function queue({ userId, template, values, payerUserId = null, booking, status, bookingDate = null, time = null, delayMs }) {
  const db = await getDb();
  await run(db, `
    INSERT INTO sms_backups (user_id, template, sms_values, payer_user_id, booking_kind, booking_id, booking_status, booking_date, booking_time, due_at)
    VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, NOW() + $10::int * INTERVAL '1 millisecond')
    ON CONFLICT (booking_kind, booking_id, user_id, template) DO UPDATE SET
      sms_values = EXCLUDED.sms_values, payer_user_id = EXCLUDED.payer_user_id, booking_status = EXCLUDED.booking_status,
      booking_date = EXCLUDED.booking_date, booking_time = EXCLUDED.booking_time,
      created_at = NOW(), due_at = EXCLUDED.due_at, settled_at = NULL, outcome = NULL
  `, [Number(userId), template, JSON.stringify(values || {}), payerUserId ? Number(payerUserId) : null,
    booking.kind, Number(booking.id), String(status), bookingDate, time, Math.max(0, Math.round(delayMs))]);
}

/**
 * Takes the backups whose ten minutes are up, settling them in the same statement so two sweeps never both send one
 * (at most once). Each comes with the person's phone and whether they opened frfro after the notice.
 */
export async function claimDue(limit = 50) {
  const db = await getDb();
  return all(db, `
    WITH due AS (
      SELECT id FROM sms_backups WHERE settled_at IS NULL AND due_at <= NOW()
      ORDER BY due_at LIMIT $1 FOR UPDATE SKIP LOCKED
    )
    UPDATE sms_backups b SET settled_at = NOW(), outcome = 'claimed'
    FROM due, users u
    WHERE b.id = due.id AND u.id = b.user_id
    RETURNING b.id, b.user_id, b.template, b.sms_values, b.payer_user_id, b.booking_kind, b.booking_id, b.booking_status,
      b.booking_date, b.booking_time, u.phone, (u.last_seen_at IS NOT NULL AND u.last_seen_at >= b.created_at) AS seen
  `, [limit]);
}

/** A proposal taken back: its held text must not reach the client about something that no longer exists. */
export async function dropProposalBackups(kind, bookingId) {
  const db = await getDb();
  await run(db, `
    UPDATE sms_backups SET settled_at = NOW(), outcome = 'changed'
    WHERE booking_kind = $1 AND booking_id = $2 AND settled_at IS NULL AND template IN ('booking_time_proposal', 'booking_handover_proposal')
  `, [String(kind), Number(bookingId)]);
}

export async function setOutcome(id, outcome) {
  const db = await getDb();
  await run(db, "UPDATE sms_backups SET outcome = $2 WHERE id = $1", [Number(id), String(outcome)]);
}

/** Settled rows older than a week go: nothing reads them after the sweep. */
export async function prune() {
  const db = await getDb();
  await run(db, "DELETE FROM sms_backups WHERE settled_at < NOW() - INTERVAL '7 days'");
}
