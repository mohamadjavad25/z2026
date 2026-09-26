import { ensureDb } from "../../../../lib/db/connection.js";
import { getUserById } from "../../../../lib/db/repos/users.js";
import { parseMediaDataUrl, ALLOWED_POSTER_TYPES } from "../../../../lib/db/repos/media.js";

export const runtime = "nodejs";

/**
 * Streams a user's profile-hero poster/banner image, same reasoning as
 * /api/media/avatar/[userId]: users.poster is a raw data:<type>;base64,<data>
 * string and must never ride along inline in a JSON payload that lists many
 * users at once.
 */
export async function GET(request, { params }) {
  await ensureDb();
  const { userId: userIdParam } = await params;
  const userId = Number(userIdParam);
  if (!userId) return new Response(null, { status: 404 });

  const user = await getUserById(userId);
  const parsed = parseMediaDataUrl(user?.poster, ALLOWED_POSTER_TYPES);
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
