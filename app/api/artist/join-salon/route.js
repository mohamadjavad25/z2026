import { json, notFound, requireUserRole } from "../../../lib/http.js";
import * as salons from "../../../lib/db/repos/salons.js";

export const runtime = "nodejs";

/** POST /api/artist/join-salon — body: { salonUserId }. The artist-initiated
 *  counterpart of POST /api/salon-invites (salon → artist): scanning the
 *  salon's QR/link lands here and joins the team immediately. */
export async function POST(request) {
  const auth = await requireUserRole(request, "artist", "فقط آرتیست.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const salonUserId = Number(body.salonUserId || body.salon_user_id || 0);
  if (!salonUserId) {
    return json({ error: "سالن نامعتبر است.", code: "INVALID_SALON" }, { status: 400 });
  }
  const result = await salons.joinSalonByArtist(salonUserId, auth.user.id);
  if (!result.ok) {
    if (result.code === "SALON_NOT_FOUND") return notFound(result.error);
    return json({ error: result.error, code: result.code }, { status: 400 });
  }
  return json({ data: result }, { status: 201 });
}
