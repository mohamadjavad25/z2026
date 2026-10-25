import { json, notFound, requireUserRole, withErrorHandling, readObjectBody } from "../../lib/http.js";
import * as salons from "../../lib/db/repos/salons.js";
import * as artists from "../../lib/db/repos/artists.js";
import { notifyConnection } from "../../lib/connectionNotify.js";
import { notifyTeamEnd } from "../../lib/teamNotify.js";
import { leaveOrRemoveFromTeam } from "../../lib/db/repos/providerExit.js";
import { exitRefusal } from "../../lib/providerExitResponse.js";
import { directVisitStats } from "../../lib/db/repos/artistPlace.js";
import { artistLeftSalon } from "../../lib/artistPlaceRelease.js";
import { formatPersianDateKey } from "../../shared/lib/persianCalendar.js";

export const runtime = "nodejs";

// There is deliberately no POST here: staff are never created by hand. A person joins
// the team only through a real artist account (an accepted invite / collaboration, or
// the salon QR join), so every member is a consenting, verifiable artist. The one
// exception is the manager themself, added via /api/salon-staff/self.

/** The team, each artist with what the salon sees of the clients they bring: how many are booked at the salon, how many different people this month, how many of those are connected to the salon. */
async function teamWithDirect(salonUserId) {
  const [staff, stats] = await Promise.all([
    salons.listSalonStaff(salonUserId),
    directVisitStats(salonUserId, formatPersianDateKey(new Date()).slice(0, 7))
  ]);
  return staff.map((person) => ({
    ...person,
    direct_stats: person.artist_user_id ? stats.get(Number(person.artist_user_id)) || { live: 0, clientsThisMonth: 0, connected: 0 } : null
  }));
}

async function _GET(request) {
  const auth = await requireUserRole(request, "salon", "این بخش مال سالن‌هاست.");
  if (!auth.ok) return auth.response;
  return json({ data: { staff: await teamWithDirect(auth.user.id) } });
}

async function _PATCH(request) {
  const auth = await requireUserRole(request, "salon", "این بخش مال سالن‌هاست.");
  if (!auth.ok) return auth.response;
  const body = await readObjectBody(request);
  const person = await salons.updateSalonStaff(Number(body.id), auth.user.id, body);
  if (!person) return notFound();
  if (person.error) return json({ error: person.error }, { status: 409 });
  // The artist hears about the switch; nothing already booked moves (it only decides what new clients can book).
  if (typeof body.directAllowed === "boolean" && person.artist_user_id) {
    notifyConnection(person.artist_user_id, body.directAllowed
      ? { title: "نوبت مستقیم توی سالن باز شد", body: `${auth.user.name || "سالن"} دوباره اجازه داد مشتری‌هات توی سالن نوبت بگیرن.`, url: "/" }
      : { title: "نوبت مستقیم توی سالن بسته شد", body: `${auth.user.name || "سالن"} نوبت مستقیم توی سالن رو بست. نوبت‌های قبلیت سر جاشونن؛ برای نوبت تازه، «جای خودم» رو انتخاب کن.`, url: "/" });
  }
  return json({ data: { person, staff: await teamWithDirect(auth.user.id) } });
}

async function _DELETE(request) {
  const auth = await requireUserRole(request, "salon", "این بخش مال سالن‌هاست.");
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
  if (artistUserId) await artistLeftSalon({ artistUserId, salonUserId: auth.user.id, salonName: auth.user.name || "" });
  // A card in the artist's app, a push, and an SMS when the push did not reach their app; `reason` is the salon's
  // optional line to the artist (owner's decision 2026-10-25).
  notifyTeamEnd({ kind: "removed", toUserId: artistUserId, from: auth.user, reason: body.reason });
  return json({
    data: {
      ok: true,
      staff: await salons.listSalonStaff(auth.user.id),
      endedCollabs,
      artistNotified: Boolean(artistUserId),
      artistUserId
    }
  });
}

export const GET = withErrorHandling(_GET);
export const PATCH = withErrorHandling(_PATCH);
export const DELETE = withErrorHandling(_DELETE);
