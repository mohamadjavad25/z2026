import { json, requireUserRole, withErrorHandling, readObjectBody } from "../../../lib/http.js";
import * as salons from "../../../lib/db/repos/salons.js";
import { notifyTeamEnd } from "../../../lib/teamNotify.js";
import { leaveOrRemoveFromTeam } from "../../../lib/db/repos/providerExit.js";
import { exitRefusal } from "../../../lib/providerExitResponse.js";
import { artistLeftSalon } from "../../../lib/artistPlaceRelease.js";
import * as users from "../../../lib/db/repos/users.js";
import { getDb } from "../../../lib/db/connection.js";

export const runtime = "nodejs";

/** GET /api/artist/teams -> the salon teams this artist currently belongs to. */
async function _GET(request) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  return json({ data: { teams: await salons.listArtistTeams(auth.user.id) } });
}

/** DELETE /api/artist/teams  body: { salonUserId } -> the artist leaves that team. */
async function _DELETE(request) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  const body = await readObjectBody(request);
  const salonUserId = Number(body.salonUserId || body.salon_user_id || 0);
  if (!salonUserId) {
    return json({ error: "این سالن رو پیدا نکردیم.", code: "INVALID_SALON" }, { status: 400 });
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
  // Clients booked at that salon keep their booking, now at the artist's own place, and are told.
  const salon = await users.getUserLiteById(salonUserId);
  await artistLeftSalon({ artistUserId: auth.user.id, salonUserId, salonName: salon?.name || "" });
  notifyTeamEnd({ kind: "left", toUserId: salonUserId, from: auth.user });
  return json({ data: { ok: true, teams: await salons.listArtistTeams(auth.user.id) } });
}

/**
 * PATCH /api/artist/teams  body: { salonUserId, postsOnSalon: boolean } -> «پست‌هام توی صفحهٔ این سالن هم بیاد» for that
 * team (on by default). -> { teams }
 */
async function _PATCH(request) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  const body = await readObjectBody(request);
  const salonUserId = Number(body.salonUserId || 0);
  if (!salonUserId || typeof body.postsOnSalon !== "boolean") {
    return json({ error: "این سالن رو پیدا نکردیم.", code: "INVALID_SALON" }, { status: 400 });
  }
  const saved = await salons.setTeamPostsOnSalon(auth.user.id, salonUserId, body.postsOnSalon, await getDb());
  if (!saved) return json({ error: "تو عضو تیم این سالن نیستی.", code: "NOT_MEMBER" }, { status: 404 });
  return json({ data: { teams: await salons.listArtistTeams(auth.user.id) } });
}

export const GET = withErrorHandling(_GET);
export const PATCH = withErrorHandling(_PATCH);
export const DELETE = withErrorHandling(_DELETE);
