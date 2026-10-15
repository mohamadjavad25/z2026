import { ensureDb, getDb, get } from "../../../../../lib/db/connection.js";
import { ensureMediaColumns } from "../../../../../lib/db/mediaSchema.js";
import { loadPicture, pictureResponse } from "../../../../../lib/mediaServe.js";
import { parseId, withErrorHandling } from "../../../../../lib/http.js";
import { requireAdmin } from "../../../../../lib/admin.js";

export const runtime = "nodejs";

/** A post's picture for the moderation grid, hidden posts included (the public route only serves those to their owner). Never cached shared. */
async function _GET(request, { params }) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return new Response(null, { status: 403 });
  await ensureMediaColumns();
  const postId = parseId((await params).id);
  if (!postId) return new Response(null, { status: 404 });
  const db = await getDb();
  const row = await get(db, "SELECT image_url, thumb_url, (thumb <> '') AS has_thumb_blob FROM posts WHERE id = $1", [postId]);
  if (!row) return new Response(null, { status: 404 });
  const full = new URL(request.url).searchParams.get("full") === "1";
  const readColumn = (column) => async () => (await get(db, `SELECT ${column} AS data FROM posts WHERE id = $1`, [postId]))?.data;
  const source = (blobColumn, urlColumn, url) => ({ url, readBlob: readColumn(blobColumn), readUrl: readColumn(urlColumn) });
  const picture = (!full && (row.thumb_url || row.has_thumb_blob) && (await loadPicture(source("thumb", "thumb_url", row.thumb_url))))
    || (await loadPicture(source("image", "image_url", row.image_url)));
  if (!picture) return new Response(null, { status: 404 });
  return pictureResponse(picture, "private, no-store");
}

export const GET = withErrorHandling(_GET);
