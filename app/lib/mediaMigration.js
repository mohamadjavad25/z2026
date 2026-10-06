import { getDb, all, get, run } from "./db/connection.js";
import { ensureMediaColumns } from "./db/mediaSchema.js";
import { isStorageConfigured, uploadImageDataUrl, verifyStoredImage, deleteStoredImage } from "./storage.js";

/**
 * One-time (and then idempotent) move of every picture that is still stored as base64 in the
 * database into Supabase Storage. Called in small time-boxed batches by /api/cron/migrate-media.
 *
 * Safety rules, in order: a base64 copy is emptied only after its Storage copy was uploaded AND
 * confirmed readable; the update is guarded so a picture re-uploaded in the meantime is left
 * alone; any failure just leaves the row as it was for the next batch. Nothing is ever lost.
 */

const BATCH = 4;

/** The Storage URL for one picture, uploading it first when it has none yet. Null if unavailable. */
async function ensureStored(blob, existingUrl, kind, ownerId) {
  let url = existingUrl || null;
  let uploaded = false;
  if (!url) {
    url = await uploadImageDataUrl(blob, { kind, ownerId });
    uploaded = Boolean(url);
  }
  if (!url) return null;
  if (await verifyStoredImage(url)) return url;
  if (uploaded) await deleteStoredImage(url);
  return null;
}

async function moveUserPictures(db, column, kind, cursor) {
  const urlColumn = `${column}_url`;
  const rows = await all(db, `
    SELECT id, ${column} AS blob, ${urlColumn} AS url, length(${column}) AS size
    FROM users WHERE ${column} <> '' AND id > $1 ORDER BY id LIMIT ${BATCH}
  `, [cursor]);
  let moved = 0;
  let failed = 0;
  for (const row of rows) {
    const url = await ensureStored(row.blob, row.url, kind, row.id);
    if (!url) { failed += 1; continue; }
    const done = await run(db, `
      UPDATE users SET ${urlColumn} = $1, ${column} = ''
      WHERE id = $2 AND ${column} <> '' AND length(${column}) = $3
    `, [url, row.id, row.size]);
    if (done.rowCount) moved += 1;
    else if (!row.url) await deleteStoredImage(url); // replaced meanwhile -- the upload is an orphan
  }
  return { moved, failed, last: rows.length ? rows[rows.length - 1].id : null, exhausted: rows.length < BATCH };
}

async function movePosts(db, cursor) {
  const rows = await all(db, `
    SELECT id, image, thumb, image_url, thumb_url, updated_at::text AS stamp
    FROM posts WHERE (image <> '' OR thumb <> '') AND id > $1 ORDER BY id LIMIT ${BATCH}
  `, [cursor]);
  let moved = 0;
  let failed = 0;
  for (const row of rows) {
    const imageUrl = row.image ? await ensureStored(row.image, row.image_url, "post", row.id) : row.image_url;
    const thumbUrl = row.thumb ? await ensureStored(row.thumb, row.thumb_url, "post", row.id) : row.thumb_url;
    // The full picture decides success; a thumb that failed keeps its base64 copy for the next batch.
    if (row.image && !imageUrl) { failed += 1; continue; }
    const done = await run(db, `
      UPDATE posts SET
        image_url = COALESCE($1, image_url), image = CASE WHEN $1::text IS NOT NULL THEN '' ELSE image END,
        thumb_url = COALESCE($2, thumb_url), thumb = CASE WHEN $2::text IS NOT NULL THEN '' ELSE thumb END
      WHERE id = $3 AND updated_at::text = $4
    `, [imageUrl, thumbUrl, row.id, row.stamp]);
    if (done.rowCount) moved += 1;
    else {
      if (!row.image_url) await deleteStoredImage(imageUrl);
      if (!row.thumb_url) await deleteStoredImage(thumbUrl);
    }
  }
  return { moved, failed, last: rows.length ? rows[rows.length - 1].id : null, exhausted: rows.length < BATCH };
}

/** How many pictures are still in the database. */
export async function countPendingMedia() {
  await ensureMediaColumns();
  const db = await getDb();
  const row = await get(db, `
    SELECT
      (SELECT COUNT(*) FROM users WHERE avatar <> '')::int AS avatars,
      (SELECT COUNT(*) FROM users WHERE poster <> '')::int AS posters,
      (SELECT COUNT(*) FROM posts WHERE image <> '' OR thumb <> '')::int AS posts
  `);
  return row;
}

/** Runs batches until the time budget is used up or nothing is left. */
export async function migrateMediaToStorage({ budgetMs = 20_000 } = {}) {
  if (!isStorageConfigured()) return { configured: false };
  await ensureMediaColumns();
  const db = await getDb();
  const deadline = Date.now() + budgetMs;
  const moved = { avatars: 0, posters: 0, posts: 0 };
  let failed = 0;

  const passes = [
    ["avatars", (cursor) => moveUserPictures(db, "avatar", "avatar", cursor)],
    ["posters", (cursor) => moveUserPictures(db, "poster", "poster", cursor)],
    ["posts", (cursor) => movePosts(db, cursor)]
  ];
  for (const [name, step] of passes) {
    let cursor = 0;
    while (Date.now() < deadline) {
      const result = await step(cursor);
      moved[name] += result.moved;
      failed += result.failed;
      if (result.exhausted) break;
      cursor = result.last;
    }
  }
  return { configured: true, moved, failed, pending: await countPendingMedia() };
}
