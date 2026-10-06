import { ensureDb, getDb, get } from "../../../../lib/db/connection.js";
import { parseMediaDataUrl, ALLOWED_POSTER_TYPES } from "../../../../lib/db/repos/media.js";
import { withErrorHandling } from "../../../../lib/http.js";
import { getUserFromRequest } from "../../../../lib/auth.js";

// Widths a grid card can ask for with ?w= (the full-size picture is only for the viewer).
// Up to this width a stored small copy (made by the browser when the post was saved) is served.
const THUMB_MAX_WIDTH = 720;
const YEAR = 60 * 60 * 24 * 365;

export const runtime = "nodejs";

/**
 * Streams a post's image instead of embedding it in every JSON response
 * that lists posts (a salon/artist portfolio — including
 * inside GET /api/salons, since listSalonPortfolio() reuses the same post
 * rows). See app/api/media/avatar/[userId]/route.js for the same fix
 * applied to avatars — together these were the reason a 5-post
 * feed shipped ~3MB of JSON and the salon directory shipped ~1.85MB.
 */
async function _GET(request, { params }) {
  await ensureDb();
  const { postId: postIdParam } = await params;
  const postId = Number(postIdParam);
  if (!postId) return new Response(null, { status: 404 });

  const db = await getDb();
  const width = Number(new URL(request.url).searchParams.get("w"));
  const wantsThumb = width > 0 && width <= THUMB_MAX_WIDTH;
  // Only pull the bytes that will actually be sent: a grid card never needs the full-size
  // column, which used to be read (and shipped out of Supabase) on every thumbnail request.
  let row = await get(db, wantsThumb
    ? "SELECT thumb AS data, is_public, owner_user_id FROM posts WHERE id = $1"
    : "SELECT image AS data, is_public, owner_user_id FROM posts WHERE id = $1", [postId]);
  if (!row) return new Response(null, { status: 404 });
  if (wantsThumb && !row.data) {
    // Posts saved before thumbnails existed fall back to the full picture.
    row = { ...row, ...(await get(db, "SELECT image AS data FROM posts WHERE id = $1", [postId])) };
  }

  // A post its owner made private is served to the owner only, and never cached shared.
  const isPrivate = row.is_public === false;
  if (isPrivate) {
    const viewer = await getUserFromRequest(request);
    if (!viewer || Number(viewer.id) !== Number(row.owner_user_id)) return new Response(null, { status: 404 });
  }

  const parsed = parseMediaDataUrl(row.data, ALLOWED_POSTER_TYPES);
  if (!parsed) return new Response(null, { status: 404 });
  const buffer = Buffer.from(parsed.base64, "base64");

  // The ?v= in every post URL changes whenever the picture does, so a versioned URL never goes stale.
  const versioned = new URL(request.url).searchParams.has("v");
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": parsed.contentType,
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(buffer.length),
      "Cache-Control": isPrivate
        ? "private, no-store"
        : versioned ? `public, max-age=${YEAR}, s-maxage=${YEAR}, immutable` : "public, max-age=3600"
    }
  });
}

export const GET = withErrorHandling(_GET);
