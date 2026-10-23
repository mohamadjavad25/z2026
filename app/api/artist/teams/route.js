import { json, requireUserRole, withErrorHandling, readObjectBody } from "../../../lib/http.js";
import * as salons from "../../../lib/db/repos/salons.js";
import { notifyConnection } from "../../../lib/connectionNotify.js";
import { leaveOrRemoveFromTeam } from "../../../lib/db/repos/providerExit.js";
import { exitRefusal } from "../../../lib/providerExitResponse.js";

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
  const body = await readObjectBody(request);
  const salonUserId = Number(body.salonUserId || body.salon_user_id || 0);
  if (!salonUserId) {
    return json({ error: "سالن نامعتبر است.", code: "INVALID_SALON" }, { status: 400 });
  }
  // Not while a confirmed booking of theirs starts within 24 hours; farther ones are handed over or cancelled with notice
  // first (owner's rules of 2026-10-22, providerExit.js); waiting requests go back to the salon unassigned.
  const exit = await leaveOrRemoveFromTeam({ scope: "team", actor: auth.user, salonUserId, cancelAll: body.cancelAll === true });
  if (!exit.ok && exit.code === "NOT_MEMBER") return json({ error: "تو عضو تیم این سالن نیستی.", code: "NOT_MEMBER" }, { status: 404 });
  if (!exit.ok) return exitRefusal(exit, { scope: "team" });
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
