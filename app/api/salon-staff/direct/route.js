import { json, requireUserRole, withErrorHandling } from "../../../lib/http.js";
import { listDirectVisits } from "../../../lib/db/repos/artistPlace.js";
import { formatPersianDateKey } from "../../../shared/lib/persianCalendar.js";

export const runtime = "nodejs";

/**
 * GET /api/salon-staff/direct → { visits: [{ id, artistName, date, time, minutes, service }] }
 * The clients a team member receives at this salon from their own page (owner's idea of 2026-10-24): when, how long and
 * which artist, from today on. Never the client's name or number; they appear in the salon's customers only once they
 * connect to the salon themselves.
 */
async function _GET(request) {
  const auth = await requireUserRole(request, "salon", "این بخش مال سالن‌هاست.");
  if (!auth.ok) return auth.response;
  const todayKey = formatPersianDateKey(new Date());
  const rows = await listDirectVisits(auth.user.id);
  return json({
    data: {
      visits: rows
        .filter((row) => String(row.booking_date || "") >= todayKey)
        .map((row) => ({
          id: row.id,
          artistName: row.artist_name || "آرتیست",
          date: row.booking_date,
          time: row.time,
          minutes: Number(row.duration_minutes) || 60,
          service: row.service || ""
        }))
    }
  });
}

export const GET = withErrorHandling(_GET);
