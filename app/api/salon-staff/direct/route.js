import { json, requireUserRole, withErrorHandling } from "../../../lib/http.js";
import { listTeamClientTimes } from "../../../lib/db/repos/artistPlace.js";
import { dateKeyAfter } from "../../../shared/lib/artistPlace.js";

export const runtime = "nodejs";

/** How far ahead the salon's day list reads its team's own clients. */
const DAYS_AHEAD = 31;

/**
 * GET /api/salon-staff/direct → { visits, busy } for today and the next month (owner's decision of 2026-10-25):
 * visits = clients a team member receives at this salon from their own page (when, service, the client's first name);
 * busy = a member's own clients held elsewhere (only when and how long). See listTeamClientTimes.
 */
async function _GET(request) {
  const auth = await requireUserRole(request, "salon", "این بخش مال سالن‌هاست.");
  if (!auth.ok) return auth.response;
  return json({ data: await listTeamClientTimes(auth.user.id, dateKeyAfter(0), dateKeyAfter(DAYS_AHEAD)) });
}

export const GET = withErrorHandling(_GET);
