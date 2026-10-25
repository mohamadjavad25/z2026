import { json, requireUserRole, withErrorHandling, readObjectBody } from "../../../lib/http.js";
import { getArtistWorkplace, setArtistWorkplace } from "../../../lib/db/repos/artistPlace.js";
import { noticeClientPlaceChanged } from "../../../lib/providerNotices.js";
import { notifyConnection } from "../../../lib/connectionNotify.js";
import { formatRelativeBookingDayLabel } from "../../../shared/lib/persianCalendar.js";

export const runtime = "nodejs";

/** GET /api/artist/place → { workplace: { current, savedCurrent, next, teams } } where the artist's own clients go. */
async function _GET(request) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  return json({ data: { workplace: await getArtistWorkplace(auth.user.id) } });
}

/**
 * PUT /api/artist/place { salonId: number | null, startsOn: "1405-08-04", moveBookings: boolean } -- "from this day on
 * my clients come to this salon" (null = my own place). Moved clients are told. → { workplace, moved, kept }
 */
async function _PUT(request) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  const body = await readObjectBody(request);
  const before = await getArtistWorkplace(auth.user.id);
  const result = await setArtistWorkplace(auth.user.id, {
    salonUserId: body.salonId ?? null,
    startsOn: body.startsOn,
    moveBookings: body.moveBookings === true
  });
  if (!result.ok) return json({ error: result.error, code: result.code }, { status: result.status });
  for (const booking of result.moved) {
    noticeClientPlaceChanged(booking.client_user_id, { artistName: auth.user.name, toSalonName: result.salonName, booking });
  }
  const after = await getArtistWorkplace(auth.user.id);
  // The salon hears when a member starts bringing their own clients there (not when a switch is only taken back).
  const salonId = Number(body.salonId || 0);
  const already = salonId && (before.savedCurrent === salonId || before.next?.salonId === salonId);
  if (salonId && !already && (after.savedCurrent === salonId || after.next?.salonId === salonId)) {
    const day = formatRelativeBookingDayLabel(body.startsOn);
    notifyConnection(salonId, {
      title: "یه آرتیست مشتری‌هاش رو میاره سالنت",
      body: `${auth.user.name || "یه آرتیست"} ${day === "امروز" ? "از امروز" : `از ${day}`} مشتری‌های خودش رو توی سالنت می‌بینه. نوبت‌هاشون توی برنامهٔ روزت بنفش دیده می‌شن.`,
      url: "/"
    });
  }
  return json({ data: { workplace: after, moved: result.moved.length, kept: result.kept } });
}

export const GET = withErrorHandling(_GET);
export const PUT = withErrorHandling(_PUT);
