import { all, getDb } from "../connection.js";
import { formatPersianDateKey } from "../../../shared/lib/persianCalendar.js";
import { RELIABILITY_MONTHS } from "../../../shared/lib/attendance.js";

/**
 * Each client's record across all of frfro (owner's decision of 2026-10-27): confirmed visits whose day has passed
 * and that nobody marked «نیومد» count as came; a «نیومد» counts at once. A salon booking's artist calendar copy is
 * not counted again. Only rows tied to a client account count (a walk-in typed in by name is nobody's record).
 *
 * Returns Map(clientUserId -> { came, noShow, recentNoShow }), with every asked id present.
 */
export async function clientReliability(clientUserIds, runner = null, now = new Date()) {
  const ids = [...new Set((clientUserIds || []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  const result = new Map(ids.map((id) => [id, { came: 0, noShow: 0, recentNoShow: 0 }]));
  if (!ids.length) return result;
  const db = runner || await getDb();
  const today = formatPersianDateKey(now);
  const rows = await all(db, `
    SELECT client_user_id,
      COUNT(*) FILTER (WHERE no_show_at IS NULL)::int AS came,
      COUNT(*) FILTER (WHERE no_show_at IS NOT NULL)::int AS no_show,
      COUNT(*) FILTER (WHERE no_show_at > NOW() - make_interval(months => $3))::int AS recent_no_show
    FROM (
      SELECT client_user_id, no_show_at FROM salon_bookings
      WHERE client_user_id = ANY($1::int[]) AND status IN ('تایید شده', 'تازه')
        AND (booking_date < $2 OR no_show_at IS NOT NULL)
      UNION ALL
      SELECT client_user_id, no_show_at FROM artist_bookings
      WHERE client_user_id = ANY($1::int[]) AND source_salon_user_id IS NULL AND status IN ('تایید', 'تایید شده')
        AND (booking_date < $2 OR no_show_at IS NOT NULL)
    ) visits
    GROUP BY client_user_id
  `, [ids, today, RELIABILITY_MONTHS]);
  for (const row of rows) {
    result.set(Number(row.client_user_id), { came: row.came, noShow: row.no_show, recentNoShow: row.recent_no_show });
  }
  return result;
}
