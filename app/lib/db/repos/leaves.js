import { all } from "../connection.js";
import { timeLabelToMinutes } from "../../../shared/lib/time.js";

/**
 * The minutes of `dateKey` an artist is on leave (owner's decision 2026-10-28): the whole day, or the hours of a leave
 * that has them. Read by listArtistBusyRanges, so every booking path (the artist's own page, a salon's team, the direct
 * bookings held at a salon) treats a leave as taken time.
 */
export async function leaveRangesOn(artistUserId, dateKey, db) {
  const rows = await all(db, `
    SELECT start_time, end_time FROM artist_leaves
    WHERE artist_user_id = $1 AND cancelled_at IS NULL AND date_from <= $2 AND date_to >= $2
  `, [artistUserId, dateKey]);
  return rows.map((row) => {
    const start = row.start_time ? timeLabelToMinutes(row.start_time) : 0;
    const end = row.end_time ? timeLabelToMinutes(row.end_time) : 1440;
    return { start, end: end > start ? end : 1440 };
  });
}
