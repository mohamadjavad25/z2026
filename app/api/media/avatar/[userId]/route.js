import { ensureDb } from "../../../../lib/db/connection.js";
import { getUserById } from "../../../../lib/db/repos/users.js";
import { parseMediaDataUrl, ALLOWED_POSTER_TYPES } from "../../../../lib/db/repos/media.js";

export const runtime = "nodejs";

/**
 * Streams a user's avatar instead of embedding it in every JSON response
 * that mentions that user (salon/artist directory listings, post owner
 * info, ...). users.avatar is stored as a raw data:<type>;base64,<data>
 * string, and shipping that inline on every list item was the single
 * biggest contributor to GET /api/salons and GET /api/explore/posts
 * ballooning to 1-3MB responses for a handful of rows. Cached hard since
 * the URL is stable per user (browsers refetch on a genuine avatar change
 * because the <img> src doesn't change — callers that need cache-busting
 * on edit already reload the page).
 */
export async function GET(request, { params }) {
  ensureDb();
  const { userId: userIdParam } = await params;
  const userId = Number(userIdParam);
  if (!userId) return new Response(null, { status: 404 });

  const user = getUserById(userId);
  const parsed = parseMediaDataUrl(user?.avatar, ALLOWED_POSTER_TYPES);
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
