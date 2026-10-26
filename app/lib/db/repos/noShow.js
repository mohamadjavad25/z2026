import { get, run, withTransaction } from "../connection.js";
import { noShowPhase } from "../../../shared/lib/providerRules.js";

/**
 * «نیومد» (owner's decision of 2026-10-25, roadmap ۱۴ stage 1): the salon (its own booking) or an independent artist
 * (a direct booking) marks that the client did not come, or takes the mark back, from the booking's start until 24
 * hours after it. The status stays confirmed; no_show_at carries the mark. A salon booking's artist calendar copies
 * carry the same mark. No text or push goes to the client: the line on their booking card is the only sign.
 *
 * Returns { ok: true, changed } or { ok: false, error: "missing" | "not_confirmed" | "not_started" | "closed" }.
 */
export async function setNoShow({ kind, id, ownerUserId, noShow }) {
  return withTransaction(null, async (db) => {
    const row = kind === "artist"
      ? await get(db, "SELECT * FROM artist_bookings WHERE id = $1 AND artist_user_id = $2 AND source_salon_user_id IS NULL FOR UPDATE", [id, ownerUserId])
      : await get(db, "SELECT * FROM salon_bookings WHERE id = $1 AND salon_user_id = $2 FOR UPDATE", [id, ownerUserId]);
    if (!row) return { ok: false, error: "missing" };
    // A salon's own walk-in entry is «تازه» and already settled; an artist's direct booking is confirmed as «تایید» or «تایید شده».
    const confirmed = kind === "artist" ? ["تایید", "تایید شده"] : ["تایید شده", "تازه"];
    if (!confirmed.includes(row.status)) return { ok: false, error: "not_confirmed" };
    const phase = noShowPhase(row.booking_date, row.time);
    if (phase === "ahead" || phase === null) return { ok: false, error: "not_started" };
    if (phase === "closed") return { ok: false, error: "closed" };
    if (Boolean(row.no_show_at) === noShow) return { ok: true, changed: false };
    const value = noShow ? new Date() : null;
    if (kind === "artist") {
      await run(db, "UPDATE artist_bookings SET no_show_at = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id, value]);
    } else {
      await run(db, "UPDATE salon_bookings SET no_show_at = $2 WHERE id = $1", [id, value]);
      // The calendar copies: a multi-service visit's point at it; a single-service copy is matched the way the sync does.
      await run(db, `
        UPDATE artist_bookings SET no_show_at = $2, updated_at = CURRENT_TIMESTAMP
        WHERE salon_booking_id = $1
          OR (salon_booking_id IS NULL AND source_salon_user_id = $3 AND client_name = $4 AND client_phone = $5
            AND service = $6 AND booking_date = $7 AND time = $8)
      `, [id, value, ownerUserId, row.client || "", row.phone || "", row.service || "", row.booking_date, row.time]);
    }
    return { ok: true, changed: true };
  });
}
