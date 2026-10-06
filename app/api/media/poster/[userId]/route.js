import { ensureDb, getDb, get } from "../../../../lib/db/connection.js";
import { parseMediaDataUrl, ALLOWED_POSTER_TYPES } from "../../../../lib/db/repos/media.js";
import { withErrorHandling } from "../../../../lib/http.js";

export const runtime = "nodejs";

/**
 * Streams a user's profile-hero poster/banner image, same reasoning as
 * /api/media/avatar/[userId]: users.poster is a raw data:<type>;base64,<data>
 * string and must never ride along inline in a JSON payload that lists many
 * users at once. Also same ETag/must-revalidate fix as that route -- a
 * flat max-age hid a re-uploaded poster behind the old cached one until
 * the hour was up.
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
  const meta = await get(db, "SELECT updated_at, length(poster) AS size FROM users WHERE id = $1 AND poster <> ''", [userId]);
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

  const row = await get(db, "SELECT poster AS data FROM users WHERE id = $1", [userId]);
  const parsed = parseMediaDataUrl(row?.data, ALLOWED_POSTER_TYPES);
  if (!parsed) return new Response(null, { status: 404 });

  const buffer = Buffer.from(parsed.base64, "base64");
  return new Response(buffer, {
    status: 200,
    headers: { ...baseHeaders, "Content-Type": parsed.contentType, "Content-Length": String(buffer.length) }
  });
}

export const GET = withErrorHandling(_GET);
