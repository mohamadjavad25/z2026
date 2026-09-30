import { createHash } from "node:crypto";
import { ensureDb } from "../../../../lib/db/connection.js";
import { getUserById } from "../../../../lib/db/repos/users.js";
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

  const user = await getUserById(userId);
  const parsed = parseMediaDataUrl(user?.poster, ALLOWED_POSTER_TYPES);
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

export const GET = withErrorHandling(_GET);
