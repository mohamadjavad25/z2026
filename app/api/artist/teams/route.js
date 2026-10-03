import { json, requireUserRole, withErrorHandling } from "../../../lib/http.js";
import * as salons from "../../../lib/db/repos/salons.js";
import { notifyConnection } from "../../../lib/connectionNotify.js";

export const runtime = "nodejs";

/** GET /api/artist/teams -> the salon teams this artist currently belongs to. */
async function _GET(request) {
  const auth = await requireUserRole(request, "artist", "فقط آرتیست.");
  if (!auth.ok) return auth.response;
  return json({ data: { teams: await salons.listArtistTeams(auth.user.id) } });
}

/** DELETE /api/artist/teams  body: { salonUserId } -> the artist leaves that team. */
async function _DELETE(request) {
  const auth = await requireUserRole(request, "artist", "فقط آرتیست.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const salonUserId = Number(body.salonUserId || body.salon_user_id || 0);
  if (!salonUserId) {
    return json({ error: "سالن نامعتبر است.", code: "INVALID_SALON" }, { status: 400 });
  }
  const result = await salons.leaveSalonTeam(auth.user.id, salonUserId);
  if (!result.ok) {
    return json({ error: result.error, code: result.code }, { status: 404 });
  }
  notifyConnection(salonUserId, {
    title: "آرتیست از تیم خارج شد",
    body: `${auth.user.name || "یک آرتیست"} همکاری با سالنت را پایان داد.`,
    url: "/"
  });
  return json({ data: { ok: true, teams: await salons.listArtistTeams(auth.user.id) } });
}

export const GET = withErrorHandling(_GET);
export const DELETE = withErrorHandling(_DELETE);
