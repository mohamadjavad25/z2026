import { ensureDb, getDb, get } from "../../../../lib/db/connection.js";
import { ensureMediaColumns } from "../../../../lib/db/mediaSchema.js";
import { loadPicture, pictureResponse } from "../../../../lib/mediaServe.js";
import { withErrorHandling } from "../../../../lib/http.js";
import { getUserFromRequest } from "../../../../lib/auth.js";

// Widths a grid card can ask for with ?w= (the full-size picture is only for the viewer).
// Up to this width the stored small copy (made by the browser when the post was saved) is served.
const THUMB_MAX_WIDTH = 720;
const YEAR = 60 * 60 * 24 * 365;

export const runtime = "nodejs";

/**
 * Streams a post's image instead of embedding it in every JSON response that lists posts. The
 * picture is in Supabase Storage (image_url / thumb_url) or, for posts not moved yet, in the row;
 * only the column that will actually be sent is ever read (a grid card used to pull the full-size
 * picture out of the database just to throw it away). See app/lib/mediaServe.js.
 */
async function _GET(request, { params }) {
  await ensureDb();
  await ensureMediaColumns();
  const { postId: postIdParam } = await params;
  const postId = Number(postIdParam);
  if (!postId) return new Response(null, { status: 404 });

  const db = await getDb();
  const query = new URL(request.url).searchParams;
  const width = Number(query.get("w"));
  const wantsThumb = width > 0 && width <= THUMB_MAX_WIDTH;
  const row = await get(db, `
    SELECT image_url, thumb_url, is_public, owner_user_id,
           (thumb <> '') AS has_thumb_blob, (image <> '') AS has_image_blob
    FROM posts WHERE id = $1`, [postId]);
  if (!row || !(row.image_url || row.has_image_blob)) return new Response(null, { status: 404 });

  // A post its owner made private is served to the owner only, and never cached shared.
  const isPrivate = row.is_public === false;
  if (isPrivate) {
    const viewer = await getUserFromRequest(request);
    if (!viewer || Number(viewer.id) !== Number(row.owner_user_id)) return new Response(null, { status: 404 });
  }

  const readColumn = (column) => async () => (await get(db, `SELECT ${column} AS data FROM posts WHERE id = $1`, [postId]))?.data;
  const source = (blobColumn, urlColumn, url) => ({ url, readBlob: readColumn(blobColumn), readUrl: readColumn(urlColumn) });
  // Small copy if there is one (posts saved before thumbnails existed fall back to the full picture).
  const thumbSource = wantsThumb && (row.thumb_url || row.has_thumb_blob)
    ? source("thumb", "thumb_url", row.thumb_url)
    : null;
  const picture = (thumbSource && (await loadPicture(thumbSource)))
    || (await loadPicture(source("image", "image_url", row.image_url)));
  if (!picture) return new Response(null, { status: 404 });

  // The ?v= in every post URL changes whenever the picture does, so a versioned URL never goes stale.
  const versioned = query.has("v");
  return pictureResponse(
    picture,
    isPrivate
      ? "private, no-store"
      : versioned ? `public, max-age=${YEAR}, s-maxage=${YEAR}, immutable` : "public, max-age=3600"
  );
}

export const GET = withErrorHandling(_GET);
