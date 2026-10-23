import { json, notFound, requireUserRole, withErrorHandling, readObjectBody } from "../../lib/http.js";
import * as salons from "../../lib/db/repos/salons.js";
import * as artists from "../../lib/db/repos/artists.js";
import { notifyConnection } from "../../lib/connectionNotify.js";
import { leaveOrRemoveFromTeam } from "../../lib/db/repos/providerExit.js";
import { exitRefusal } from "../../lib/providerExitResponse.js";

export const runtime = "nodejs";

// There is deliberately no POST here: staff are never created by hand. A person joins
// the team only through a real artist account (an accepted invite / collaboration, or
// the salon QR join), so every member is a consenting, verifiable artist. The one
// exception is the manager themself, added via /api/salon-staff/self.

async function _GET(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  return json({ data: { staff: await salons.listSalonStaff(auth.user.id) } });
}

async function _PATCH(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await readObjectBody(request);
  const person = await salons.updateSalonStaff(Number(body.id), auth.user.id, body);
  if (!person) return notFound();
  if (person.error) return json({ error: person.error }, { status: 409 });
  return json({ data: { person, staff: await salons.listSalonStaff(auth.user.id) } });
}

async function _DELETE(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await readObjectBody(request);
  // Not while a confirmed booking of that member starts within 24 hours; farther ones are handed over or cancelled with
  // notice first; their waiting requests go back to the salon unassigned (owner's rules of 2026-10-22, providerExit.js).
  const exit = await leaveOrRemoveFromTeam({ scope: "staff", actor: auth.user, salonUserId: auth.user.id, staffId: Number(body.id), cancelAll: body.cancelAll === true });
  if (!exit.ok && exit.code === "NOT_FOUND") return notFound();
  if (!exit.ok) return exitRefusal(exit, { scope: "staff" });
  const result = await salons.deleteSalonStaff(Number(body.id), auth.user.id);
  if (!result?.ok) return notFound();
  const artistUserId = Number(result.person?.artist_user_id || 0) || null;
  const endedCollabs = artistUserId
    ? await artists.endSalonCollabsForArtist(auth.user.id, artistUserId)
    : 0;
  notifyConnection(artistUserId, {
    title: "همکاری پایان یافت",
    body: `همکاری‌ات با ${auth.user.name || "سالن"} پایان یافت.`,
    url: "/"
  });
  return json({
    data: {
      ok: true,
      staff: await salons.listSalonStaff(auth.user.id),
      endedCollabs,
      artistNotified: endedCollabs > 0,
      artistUserId
    }
  });
}

export const GET = withErrorHandling(_GET);
export const PATCH = withErrorHandling(_PATCH);
export const DELETE = withErrorHandling(_DELETE);
