import { get, run, withTransaction } from "../connection.js";
import { clientBookingMatch, clientVisibleStatus } from "../clientMatch.js";
import { attendanceState } from "../../../shared/lib/attendance.js";
import { proposalView } from "../../../shared/lib/providerRules.js";

/**
 * «آره، میام» (owner's decision of 2026-10-27): the client says they are coming to a confirmed visit that starts within
 * a day. Found by the same rule the client's own list uses. A salon booking's artist calendar copies carry the answer
 * too, so the team artist sees it as well.
 *
 * Returns { ok: true, changed, booking } or { ok: false, error: "missing" | "not_open" }.
 */
export async function confirmAttendance({ kind, id, client, now = new Date() }) {
  const match = clientBookingMatch(client, { alias: "b", startAt: 2 });
  if (!match.sql) return { ok: false, error: "missing" };
  return withTransaction(null, async (db) => {
    const row = kind === "artist"
      ? await get(db, `SELECT b.* FROM artist_bookings b WHERE b.id = $1 AND b.source_salon_user_id IS NULL AND ${match.sql} FOR UPDATE`, [id, ...match.params])
      : await get(db, `SELECT b.* FROM salon_bookings b WHERE b.id = $1 AND ${match.sql} FOR UPDATE`, [id, ...match.params]);
    if (!row) return { ok: false, error: "missing" };
    const view = { ...row, status: clientVisibleStatus(row.status, kind), proposal: proposalView(row, now) };
    const state = attendanceState(view, now);
    if (state === "yes") return { ok: true, changed: false, booking: row };
    if (state !== "ask") return { ok: false, error: "not_open" };
    if (kind === "artist") {
      await run(db, "UPDATE artist_bookings SET client_confirmed_at = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id, now]);
    } else {
      await run(db, "UPDATE salon_bookings SET client_confirmed_at = $2 WHERE id = $1", [id, now]);
      await run(db, `
        UPDATE artist_bookings SET client_confirmed_at = $2, updated_at = CURRENT_TIMESTAMP
        WHERE salon_booking_id = $1
          OR (salon_booking_id IS NULL AND source_salon_user_id = $3 AND client_name = $4 AND client_phone = $5
            AND service = $6 AND booking_date = $7 AND time = $8)
      `, [id, now, row.salon_user_id, row.client || "", row.phone || "", row.service || "", row.booking_date, row.time]);
    }
    return { ok: true, changed: true, booking: { ...row, client_confirmed_at: now } };
  });
}
