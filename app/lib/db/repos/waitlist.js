import { all, get, getDb, run } from "../connection.js";
import { formatPersianDateKey } from "../../../shared/lib/persianCalendar.js";

/**
 * «خبرم کن» (owner's decision of 2026-10-27, roadmap ۱۹): a client waits for a time to free up on one day at one salon
 * or independent artist, for the services they picked (services: [{ name, minutes }]). One entry per client, place and
 * day; asking again replaces the services. See app/lib/waitlist.js for when they are told.
 */
export const WAITLIST_MAX_ACTIVE = 5;

const today = (now) => formatPersianDateKey(now);

/** The client's entries from today on, soonest first, with the place's name. */
export async function listClientWaitlist(clientUserId, now = new Date()) {
  const db = await getDb();
  return all(db, `
    SELECT w.id, w.owner_kind, w.owner_user_id, w.booking_date, w.services, w.notified_at, w.created_at,
      COALESCE(NULLIF(s.name, ''), u.name, '') AS owner_name
    FROM booking_waitlist w
    LEFT JOIN users u ON u.id = w.owner_user_id
    LEFT JOIN salons s ON s.user_id = w.owner_user_id AND w.owner_kind = 'salon'
    WHERE w.client_user_id = $1 AND w.booking_date >= $2
    ORDER BY w.booking_date ASC, w.id ASC
  `, [clientUserId, today(now)]);
}

/**
 * Adds (or renews) an entry. `freeSignature` is what is free right now, so only a time that frees up later is announced.
 * Returns { ok: true, entry } or { ok: false, error: "too_many" }.
 */
export async function upsertWaitlistEntry({ clientUserId, kind, ownerUserId, bookingDate, services, freeSignature = "" }, now = new Date()) {
  const db = await getDb();
  const existing = await get(db, `
    SELECT id FROM booking_waitlist WHERE client_user_id = $1 AND owner_kind = $2 AND owner_user_id = $3 AND booking_date = $4
  `, [clientUserId, kind, ownerUserId, bookingDate]);
  if (!existing) {
    const active = await get(db, "SELECT COUNT(*)::int AS n FROM booking_waitlist WHERE client_user_id = $1 AND booking_date >= $2", [clientUserId, today(now)]);
    if (Number(active?.n || 0) >= WAITLIST_MAX_ACTIVE) return { ok: false, error: "too_many" };
  }
  const entry = await get(db, `
    INSERT INTO booking_waitlist (client_user_id, owner_kind, owner_user_id, booking_date, services, free_signature)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6)
    ON CONFLICT (client_user_id, owner_kind, owner_user_id, booking_date)
    DO UPDATE SET services = EXCLUDED.services, free_signature = EXCLUDED.free_signature, notified_at = NULL, created_at = NOW()
    RETURNING *
  `, [clientUserId, kind, ownerUserId, bookingDate, JSON.stringify(services), freeSignature]);
  return { ok: true, entry };
}

export async function deleteWaitlistEntry(clientUserId, id) {
  const db = await getDb();
  const res = await run(db, "DELETE FROM booking_waitlist WHERE id = $1 AND client_user_id = $2", [id, clientUserId]);
  return res.rowCount > 0;
}

/** Everyone waiting at this place on this day. */
export async function waitlistEntriesFor(kind, ownerUserId, bookingDate) {
  const db = await getDb();
  return all(db, `
    SELECT * FROM booking_waitlist WHERE owner_kind = $1 AND owner_user_id = $2 AND booking_date = $3 ORDER BY id ASC
  `, [kind, ownerUserId, bookingDate]);
}

/** The places and days anyone is still waiting for, after clearing the days that are over. */
export async function activeWaitlistDays(now = new Date(), limit = 300) {
  const db = await getDb();
  await run(db, "DELETE FROM booking_waitlist WHERE booking_date < $1", [today(now)]);
  return all(db, `
    SELECT owner_kind, owner_user_id, booking_date FROM booking_waitlist
    GROUP BY owner_kind, owner_user_id, booking_date
    ORDER BY booking_date ASC
    LIMIT $1
  `, [limit]);
}

/**
 * Claims the right to tell this entry about `signature`: true once per new set of free times (the update only goes
 * through while the stored signature is still the one read), and no more than once every `cooldownMinutes`.
 */
export async function claimWaitlistNotice(entry, signature, cooldownMinutes = 10) {
  const db = await getDb();
  const res = await run(db, `
    UPDATE booking_waitlist SET free_signature = $3, notified_at = NOW()
    WHERE id = $1 AND free_signature = $2
      AND (notified_at IS NULL OR notified_at < NOW() - make_interval(mins => $4))
  `, [entry.id, entry.free_signature || "", signature, cooldownMinutes]);
  return res.rowCount > 0;
}

/** Nothing is free any more: the next opening, even of the same time, is news again. */
export async function clearWaitlistSignature(id) {
  const db = await getDb();
  await run(db, "UPDATE booking_waitlist SET free_signature = '' WHERE id = $1 AND free_signature <> ''", [id]);
}

/** Whether the client already holds an active visit at this place on this day (then they no longer wait). */
export async function clientHasVisitThere(clientUserId, kind, ownerUserId, bookingDate) {
  const db = await getDb();
  const row = kind === "artist"
    ? await get(db, `
        SELECT 1 FROM artist_bookings WHERE client_user_id = $1 AND artist_user_id = $2 AND booking_date = $3
          AND source_salon_user_id IS NULL AND status IN ('تازه', 'درخواست', 'تایید', 'تایید شده') LIMIT 1
      `, [clientUserId, ownerUserId, bookingDate])
    : await get(db, `
        SELECT 1 FROM salon_bookings WHERE client_user_id = $1 AND salon_user_id = $2 AND booking_date = $3
          AND status IN ('تازه', 'درخواست', 'تایید شده', 'در انتظار مشتری') LIMIT 1
      `, [clientUserId, ownerUserId, bookingDate]);
  return Boolean(row);
}

export async function deleteWaitlistById(id) {
  const db = await getDb();
  await run(db, "DELETE FROM booking_waitlist WHERE id = $1", [id]);
}
