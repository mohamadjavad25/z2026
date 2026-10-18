import { createHash } from "node:crypto";
import { ensureDb } from "../../../../lib/db/connection.js";
import { loadPicture, pictureResponse } from "../../../../lib/mediaServe.js";
import { withErrorHandling } from "../../../../lib/http.js";
import * as salons from "../../../../lib/db/repos/salons.js";

export const runtime = "nodejs";

/**
 * The photo a salon manager chose for their own card on the team (salon_owner_profile.photo). Public like
 * every avatar: clients see it when picking an artist. The URL carries ?v=<stamp>, and the ETag makes the
 * browser revalidate, so a new upload shows at once.
 */
async function _GET(request, { params }) {
  await ensureDb();
  const { salonId: salonIdParam } = await params;
  const salonId = Number(salonIdParam);
  if (!salonId) return new Response(null, { status: 404 });
  const row = await salons.getSalonOwnerPhoto(salonId);
  if (!row) return new Response(null, { status: 404 });

  const etag = `"${createHash("sha1").update(`${salonId}|${row.stamp}|${row.photo.length}`).digest("hex")}"`;
  const cacheControl = "public, max-age=0, s-maxage=30, must-revalidate";
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { "X-Content-Type-Options": "nosniff", "Cache-Control": cacheControl, ETag: etag } });
  }
  const picture = await loadPicture({ url: null, readBlob: async () => row.photo });
  if (!picture) return new Response(null, { status: 404 });
  return pictureResponse(picture, cacheControl, { ETag: etag });
}

export const GET = withErrorHandling(_GET);
