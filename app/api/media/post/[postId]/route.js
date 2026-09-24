import { ensureDb, getDb } from "../../../../lib/db/connection.js";
import { parseStoryDataUrl, ALLOWED_POSTER_TYPES } from "../../../../lib/db/repos/stories.js";

export const runtime = "nodejs";

/**
 * Streams a post's image instead of embedding it in every JSON response
 * that lists posts (explore feed, a salon/artist's portfolio — including
 * inside GET /api/salons, since listSalonPortfolio() reuses the same post
 * rows). See app/api/media/avatar/[userId]/route.js for the same fix
 * applied to avatars — together these were the reason a 5-post explore
 * feed shipped ~3MB of JSON and the salon directory shipped ~1.85MB.
 */
export async function GET(request, { params }) {
  ensureDb();
  const { postId: postIdParam } = await params;
  const postId = Number(postIdParam);
  if (!postId) return new Response(null, { status: 404 });

  const row = getDb().prepare("SELECT image FROM posts WHERE id = ?").get(postId);
  const parsed = parseStoryDataUrl(row?.image, ALLOWED_POSTER_TYPES);
  if (!parsed) return new Response(null, { status: 404 });

  const buffer = Buffer.from(parsed.base64, "base64");
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": parsed.contentType,
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(buffer.length),
      "Cache-Control": "public, max-age=3600"
    }
  });
}
