import { createHash } from "node:crypto";
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
 * ballooning to 1-3MB responses for a handful of rows.
 *
 * The URL is stable per user, so it used to be cached hard
 * (max-age=3600) on the assumption the browser would somehow notice a
 * re-upload anyway -- it doesn't: a stable <img src> under a fresh
 * max-age never re-requests at all, so re-uploading a new avatar/poster
 * kept showing the old one for up to an hour (reported bug: picking a
 * new image "doesn't replace" the old one). An ETag from the actual
 * image bytes plus must-revalidate makes the browser always send a
 * conditional request: a cheap 304 when the avatar hasn't changed, a
 * fresh 200 the moment it has.
 */
export async function GET(request, { params }) {
  await ensureDb();
  const { userId: userIdParam } = await params;
  const userId = Number(userIdParam);
  if (!userId) return new Response(null, { status: 404 });

  const user = await getUserById(userId);
  const parsed = parseMediaDataUrl(user?.avatar, ALLOWED_POSTER_TYPES);
  if (!parsed) return new Response(null, { status: 404 });

  const buffer = Buffer.from(parsed.base64, "base64");
  const etag = `"${createHash("sha1").update(buffer).digest("hex")}"`;
  const headers = {
    "Content-Type": parsed.contentType,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=0, must-revalidate",
    ETag: etag
  };

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(buffer, {
    status: 200,
    headers: { ...headers, "Content-Length": String(buffer.length) }
  });
}
