/** What a client may do to their own salon booking: answer a time the salon offered, and cancel. */
import { getDb, get, run } from "../../../connection.js";
import { clientBookingMatch } from "../../../clientMatch.js";
import { minutesUntilSlotStart } from "../../../../../shared/lib/bookingWindow.js";
import { AWAITING_CLIENT } from "../../../../../shared/lib/bookingOffer.js";
import { SALON_LIVE, SQL_SALON_LIVE } from "../../../../../shared/lib/bookingStates.js";
import { ensureBookingPartsColumns } from "./columns.js";
import { patchSalonBookingWithArtistSync } from "./patch.js";

/**
 * A salon booking that is this client's, by the same rule their list uses (clientBookingMatch):
 * a booking the salon typed in for them, with no account id, is theirs too.
 */
async function findClientOwnBooking(db, id, client) {
  const user = typeof client === "object" && client ? client : { id: client };
  const match = clientBookingMatch(user, { alias: "b", startAt: 2 });
  if (!match.sql) return null;
  return get(db, `SELECT b.* FROM salon_bookings b WHERE b.id = $1 AND ${match.sql}`, [id, ...match.params]);
}

/**
 * The client answering a new time the salon offered: accepting confirms the booking at that
 * time, declining cancels it (they can then book another time). Either way the artists'
 * calendar copies follow, through the same path as the salon's own approve / cancel.
 */
export async function answerSalonTimeOffer(id, client, accept) {
  await ensureBookingPartsColumns();
  const db = await getDb();
  const current = await findClientOwnBooking(db, id, client);
  if (!current) return { ok: false, error: "missing" };
  if (current.status !== AWAITING_CLIENT) return { ok: false, error: "inactive" };
  const result = await patchSalonBookingWithArtistSync(
    id,
    current.salon_user_id,
    { status: accept ? "تایید شده" : "لغو" },
    // The offer must still be waiting when the change is made, not only when it was looked up above: a second
    // answer arriving at the same instant (accept and decline together) found the first one's result and acted on
    // it, so both "won" (stress test 4b, seen in CI on 2026-11-10).
    { clientAnswer: true, expectStatus: AWAITING_CLIENT }
  );
  return result.ok ? { ...result, salonUserId: current.salon_user_id } : result;
}

/**
 * A client cancels their OWN salon booking. Only the booking's client may do it, only while it
 * is still active (waiting or confirmed) and not in the past; everything else -- the artist
 * calendar sync, slot release -- goes through the same path as the salon cancelling.
 */
export async function cancelSalonBookingByClient(id, client) {
  const db = await getDb();
  const current = await findClientOwnBooking(db, id, client);
  if (!current) return { ok: false, error: "missing" };
  if (!SALON_LIVE.includes(current.status)) return { ok: false, error: "inactive" };
  // Once the appointment has started (today's 10:00 at 14:29) it can't be cancelled any more.
  const until = minutesUntilSlotStart(current.booking_date, current.time);
  if (until !== null && until <= 0) return { ok: false, error: "past" };
  // A booking whose salon is gone (cancelled when the salon left frfro, or an older row left behind) has no salon
  // to run the artist-calendar sync for: the row alone is closed.
  if (!current.salon_user_id) {
    const changed = await run(db, `
      UPDATE salon_bookings SET status = 'لغو', cancelled_by = 'client', proposal_date = '', proposal_time = '', proposal_staff = '', proposal_from = '', proposal_at = NULL
      WHERE id = $1 AND status IN (${SQL_SALON_LIVE})
    `, [id]);
    return changed.rowCount ? { ok: true, booking: { ...current, status: "لغو" }, salonUserId: null } : { ok: false, error: "inactive" };
  }
  const result = await patchSalonBookingWithArtistSync(id, current.salon_user_id, { status: "لغو" }, { cancelledBy: { by: "client" } });
  return result.ok ? { ok: true, booking: result.booking, salonUserId: current.salon_user_id } : result;
}
