import { ensureDb } from "../../../../lib/db/connection.js";
import { serveUserPicture } from "../../../../lib/mediaServe.js";
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
  return serveUserPicture(request, userId, "poster");
}

export const GET = withErrorHandling(_GET);
