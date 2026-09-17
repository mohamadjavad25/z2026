import { getUserFromRequest } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { error, json } from "../../../lib/http.js";
import * as artists from "../../../lib/db/repos/artists.js";

export const runtime = "nodejs";

export async function POST(request) {
  ensureDb();
  const body = await request.json();
  const artistUserId = Number(body.artistUserId);
  if (!artistUserId) return error("آرتیست نامعتبر است.", 400);
  const viewer = getUserFromRequest(request);
  const result = artists.addArtistBooking(artistUserId, {
    ...body,
    clientUserId: viewer?.id || null,
    clientName: body.clientName || viewer?.name || "",
    clientPhone: body.clientPhone || viewer?.phone || ""
  });
  if (!result.ok) {
    return json({ error: result.error, code: result.code }, { status: result.code === "SLOT_TAKEN" ? 409 : 400 });
  }
  return json({
    data: {
      booking: result.booking,
      bookedSlots: artists.listArtistBookedSlots(artistUserId)
    }
  }, { status: 201 });
}
