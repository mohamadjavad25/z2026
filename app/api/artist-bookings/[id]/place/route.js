import { json, notFound, parseId, readObjectBody, requireUserRole, withErrorHandling } from "../../../../lib/http.js";
import { moveBookingPlace, movablePlaces } from "../../../../lib/db/repos/artistPlace.js";
import { noticeClientPlaceChanged } from "../../../../lib/providerNotices.js";

export const runtime = "nodejs";

/**
 * PUT /api/artist-bookings/:id/place { salonUserId: number | null } -- the artist says where one of their bookings is held:
 * one of their salons, or null for «مثل قبل». The client is told when a confirmed booking moves.
 */
async function _PUT(request, { params }) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const body = await readObjectBody(request);
  const result = await moveBookingPlace(auth.user.id, id, body.salonUserId);
  if (!result.ok) return json({ error: result.error, ...(result.code ? { code: result.code } : {}) }, { status: result.status });
  if (result.changed && result.booking.client_user_id && result.booking.status !== "تازه" && result.booking.status !== "درخواست") {
    const to = body.salonUserId ? (await movablePlaces(auth.user.id)).find((team) => Number(team.salon_user_id) === Number(body.salonUserId)) : null;
    noticeClientPlaceChanged(result.booking.client_user_id, { artistName: auth.user.name, toSalonName: to?.salon_name || "", booking: result.booking });
  }
  return json({ data: { ok: true, changed: result.changed } });
}

export const PUT = withErrorHandling(_PUT);
