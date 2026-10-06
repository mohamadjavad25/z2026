import { ensureDb, getDb, get } from "../../../../lib/db/connection.js";
import { parseMediaDataUrl, ALLOWED_POSTER_TYPES } from "../../../../lib/db/repos/media.js";
import { withErrorHandling } from "../../../../lib/http.js";

export const runtime = "nodejs";

/**
 * Streams a user's avatar instead of embedding it in every JSON response
 * that mentions that user (salon/artist directory listings, post owner
 * info, ...). users.avatar is stored as a raw data:<type>;base64,<data>
 * string, and shipping that inline on every list item was the single
 * biggest contributor to GET /api/salons
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
async function _GET(request, { params }) {
  await ensureDb();
  const { userId: userIdParam } = await params;
  const userId = Number(userIdParam);
  if (!userId) return new Response(null, { status: 404 });

  // Cheap revalidation first: a fingerprint (row version + size) is all the DB has to
  // hand over for the common "has it changed?" request. The multi-MB base64 column only
  // leaves Supabase when the browser really needs the bytes (this was the egress hog).
  const db = await getDb();
  const meta = await get(db, "SELECT updated_at, length(avatar) AS size FROM users WHERE id = $1 AND avatar <> ''", [userId]);
  if (!meta) return new Response(null, { status: 404 });
  const etag = `"${userId}-${new Date(meta.updated_at).getTime()}-${meta.size}"`;
  const baseHeaders = {
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=0, must-revalidate",
    ETag: etag
  };
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: baseHeaders });
  }

  const row = await get(db, "SELECT avatar AS data FROM users WHERE id = $1", [userId]);
  const parsed = parseMediaDataUrl(row?.data, ALLOWED_POSTER_TYPES);
  if (!parsed) return new Response(null, { status: 404 });

  const buffer = Buffer.from(parsed.base64, "base64");
  return new Response(buffer, {
    status: 200,
    headers: { ...baseHeaders, "Content-Type": parsed.contentType, "Content-Length": String(buffer.length) }
  });
}

export const GET = withErrorHandling(_GET);
