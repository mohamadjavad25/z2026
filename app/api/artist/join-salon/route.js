import { json, notFound, requireUserRole, withErrorHandling } from "../../../lib/http.js";
import * as salons from "../../../lib/db/repos/salons.js";
import { TEAM_URL, notifyConnection } from "../../../lib/connectionNotify.js";

export const runtime = "nodejs";

/** POST /api/artist/join-salon — body: { salonUserId, code, termsVersion } (the `version` of the terms the join page showed). The artist-initiated
 *  counterpart of POST /api/salon-invites (salon → artist): scanning the
 *  salon's QR/link lands here and joins the team immediately. `code` is the
 *  secret embedded in that link (see getOrCreateSalonJoinSecret) — without
 *  it, salonUserId alone is just the salon's small public id and proves
 *  nothing. */
async function _POST(request) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const salonUserId = Number(body.salonUserId || body.salon_user_id || 0);
  const code = String(body.code || "").trim();
  if (!salonUserId) {
    return json({ error: "این سالن رو پیدا نکردیم.", code: "INVALID_SALON" }, { status: 400 });
  }
  const result = await salons.joinSalonByArtist(salonUserId, auth.user.id, code, { termsVersion: body.termsVersion });
  if (!result.ok) {
    if (result.code === "SALON_NOT_FOUND") return notFound(result.error);
    // The salon changed its terms (or has none yet) since the artist read the page: she must see the new ones first.
    if (result.code === "TERMS_CHANGED") return json({ error: result.error, code: result.code, terms: result.terms }, { status: 409 });
    if (result.code === "TERMS_NOT_READY") return json({ error: result.error, code: result.code }, { status: 409 });
    return json({ error: result.error, code: result.code }, { status: 400 });
  }
  notifyConnection(salonUserId, {
    title: "یه آرتیست تازه اومد توی تیمت",
    body: `${auth.user.name || "یه آرتیست"} با کد سالنت اومد توی تیم.`,
    url: TEAM_URL
  });
  return json({ data: result }, { status: 201 });
}

export const POST = withErrorHandling(_POST);
