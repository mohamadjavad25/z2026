import { getDb, all } from "./db/connection.js";
import { sendPushToUser } from "./push.js";

/**
 * Push for the artists on a salon's team whose visit it is (the artist_bookings mirror of a salon booking). Before
 * this only the salon and the client heard about a request, a confirmation or a cancellation, and the artist had to
 * open the app to find out. `artistIds` when the caller already has them, else they are looked up from
 * `salonBookingId`. `exceptUserId` is whoever made the change (never told about their own action). Fire-and-forget.
 */
export function notifyStaff({ salonBookingId = null, artistIds = null, exceptUserId = null }, { title, body, url = "/" }) {
  void (async () => {
    let ids = (artistIds || []).map(Number).filter(Boolean);
    if (!ids.length && salonBookingId) {
      const db = await getDb();
      const rows = await all(db, "SELECT DISTINCT artist_user_id FROM artist_bookings WHERE salon_booking_id = $1 AND artist_user_id IS NOT NULL", [Number(salonBookingId)]);
      ids = rows.map((row) => Number(row.artist_user_id));
    }
    const targets = [...new Set(ids)].filter((id) => id !== Number(exceptUserId || 0));
    await Promise.allSettled(targets.map((id) => sendPushToUser(id, { title, body, url })));
  })().catch(() => {});
}
