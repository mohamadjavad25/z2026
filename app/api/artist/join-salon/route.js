import { json, notFound, requireUserRole, withErrorHandling } from "../../../lib/http.js";
import * as salons from "../../../lib/db/repos/salons.js";
import { notifyConnection } from "../../../lib/connectionNotify.js";

export const runtime = "nodejs";

/** POST /api/artist/join-salon — body: { salonUserId }. The artist-initiated
 *  counterpart of POST /api/salon-invites (salon → artist): scanning the
 *  salon's QR/link lands here and joins the team immediately. */
async function _POST(request) {
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
  notifyConnection(salonUserId, {
    title: "آرتیست جدید در تیم",
    body: `${auth.user.name || "یک آرتیست"} با کد QR سالنت به تیم پیوست.`,
    url: "/"
  });
  return json({ data: result }, { status: 201 });
}

export const POST = withErrorHandling(_POST);
