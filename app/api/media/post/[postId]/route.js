import { ensureDb, getDb, get } from "../../../../lib/db/connection.js";
import { parseMediaDataUrl, ALLOWED_POSTER_TYPES } from "../../../../lib/db/repos/media.js";
import { withErrorHandling } from "../../../../lib/http.js";
import { getUserFromRequest } from "../../../../lib/auth.js";
import { THUMB_WIDTH, resizeDataUrl } from "../../../../lib/postThumb.js";
import { run } from "../../../../lib/db/connection.js";

// Widths a grid card can ask for with ?w= (the full-size picture is only for the viewer).
const THUMB_WIDTHS = new Set([240, 480, 720]);
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
  const wantsThumb = THUMB_WIDTHS.has(width);
  const row = await get(db, `
    SELECT ${wantsThumb && width <= THUMB_WIDTH ? "thumb," : ""} is_public, owner_user_id,
      ${wantsThumb && width <= THUMB_WIDTH ? "" : "image,"} 1 AS present
    FROM posts WHERE id = $1`, [postId]);
  if (!row) return new Response(null, { status: 404 });

  // A post its owner made private is served to the owner only, and never cached shared.
  const isPrivate = row.is_public === false;
  if (isPrivate) {
    const viewer = await getUserFromRequest(request);
    if (!viewer || Number(viewer.id) !== Number(row.owner_user_id)) return new Response(null, { status: 404 });
  }

  let buffer;
  let contentType;
  if (wantsThumb && width <= THUMB_WIDTH && row.thumb) {
    // Made when the post was saved: nothing to resize.
    buffer = Buffer.from(row.thumb, "base64");
    contentType = "image/webp";
  } else {
    const full = wantsThumb && width <= THUMB_WIDTH
      ? (await get(db, "SELECT image FROM posts WHERE id = $1", [postId]))?.image
      : row.image;
    const parsed = parseMediaDataUrl(full, ALLOWED_POSTER_TYPES);
    if (!parsed) return new Response(null, { status: 404 });
    buffer = Buffer.from(parsed.base64, "base64");
    contentType = parsed.contentType;
    if (wantsThumb) {
      const resized = await resizeDataUrl(full, width);
      if (resized) {
        buffer = resized;
        contentType = "image/webp";
        // Older posts have no stored thumbnail yet: keep the 480 one for next time.
        if (width === THUMB_WIDTH) {
          void run(db, "UPDATE posts SET thumb = $1 WHERE id = $2 AND thumb = ''", [resized.toString("base64"), postId]).catch(() => {});
        }
      }
    }
  }

  // The ?v= in every post URL changes whenever the picture does, so a versioned URL never goes stale.
  const versioned = new URL(request.url).searchParams.has("v");
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(buffer.length),
      "Cache-Control": isPrivate
        ? "private, no-store"
        : versioned ? `public, max-age=${YEAR}, immutable` : "public, max-age=3600"
    }
  });
}

export const GET = withErrorHandling(_GET);
