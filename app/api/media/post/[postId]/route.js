import { ensureDb, getDb, get } from "../../../../lib/db/connection.js";
import { parseMediaDataUrl, ALLOWED_POSTER_TYPES } from "../../../../lib/db/repos/media.js";
import { withErrorHandling } from "../../../../lib/http.js";
import { getUserFromRequest } from "../../../../lib/auth.js";

export const runtime = "nodejs";

/**
 * Streams a post's image instead of embedding it in every JSON response
 * that lists posts (explore feed, a salon/artist's portfolio — including
 * inside GET /api/salons, since listSalonPortfolio() reuses the same post
 * rows). See app/api/media/avatar/[userId]/route.js for the same fix
 * applied to avatars — together these were the reason a 5-post explore
 * feed shipped ~3MB of JSON and the salon directory shipped ~1.85MB.
 */
async function _GET(request, { params }) {
  await ensureDb();
  const { postId: postIdParam } = await params;
  const postId = Number(postIdParam);
  if (!postId) return new Response(null, { status: 404 });

  const row = await get(await getDb(), "SELECT image, in_explore, owner_user_id FROM posts WHERE id = $1", [postId]);
  const parsed = parseMediaDataUrl(row?.image, ALLOWED_POSTER_TYPES);
  if (!parsed) return new Response(null, { status: 404 });

  // A post its owner made private is served to the owner only, and never cached shared.
  const isPrivate = row.in_explore === false;
  if (isPrivate) {
    const viewer = await getUserFromRequest(request);
    if (!viewer || Number(viewer.id) !== Number(row.owner_user_id)) return new Response(null, { status: 404 });
  }

  const buffer = Buffer.from(parsed.base64, "base64");
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": parsed.contentType,
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(buffer.length),
      "Cache-Control": isPrivate ? "private, no-store" : "public, max-age=3600"
    }
  });
}

export const GET = withErrorHandling(_GET);
