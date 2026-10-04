import { makeThumbBase64 } from "../../postThumb.js";
import { getDb, all, get, run, withTransaction } from "../connection.js";
import { uploadImageDataUrl } from "../../storage.js";

// Both image/ownerAvatar are stored as raw data:<type>;base64,<data> strings
// in the DB but shipped here as media-endpoint URLs, never inline -- this
// mapper is the single choke point for every post list (a
// salon/artist's portfolio via listSalonPortfolio -> listPostsByOwner), so
// embedding the raw base64 here was why a post list shipped
// ~3MB of JSON and the salon directory (which embeds each salon's full
// portfolio) shipped ~1.85MB for a handful of salons. See
// app/api/media/post/[postId]/route.js and .../media/avatar/[userId]/route.js.
function mapPost(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    tag: row.tag || "",
    image: row.image ? `/api/media/post/${row.id}?v=${row.updated_at ? new Date(row.updated_at).getTime() : 0}` : "",
    caption: row.caption || "",
    isPublic: Boolean(row.is_public),
    featured: Boolean(row.featured),
    saves: String(row.saves_count || 0),
    views: String(row.views_count || 0),
    salon: row.owner_name || "",
    ownerType: row.owner_type || "",
    ownerAvatar: row.owner_avatar ? `/api/media/avatar/${row.owner_user_id}` : "",
    ownerAvatarPosition: row.owner_avatar_position || "",
    ownerArea: row.owner_area || "",
    ownerBio: row.owner_bio || "",
    ownerService: row.owner_service || "",
    createdAt: row.created_at
  };
}

const postSelect = `
  SELECT p.id, p.owner_user_id, p.title, p.tag, p.caption, p.is_public, p.featured, p.saves_count, p.views_count, p.created_at, p.updated_at, p.image_url,
    (p.image <> '') AS image,
    u.name AS owner_name,
    u.type AS owner_type,
    (u.avatar <> '') AS owner_avatar,
    u.avatar_position AS owner_avatar_position,
    u.area AS owner_area,
    u.bio AS owner_bio,
    u.service AS owner_service
  FROM posts p
  JOIN users u ON u.id = p.owner_user_id
`;

export const POST_LIMITS = Object.freeze({ title: 80, tag: 40, caption: 600, pinned: 3 });

function clip(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

/** Builds and stores the 480px thumbnail for a post (best effort: the media route also makes one on demand). */
async function storeThumb(db, postId, image) {
  try {
    const thumb = await makeThumbBase64(image);
    if (thumb) await run(db, "UPDATE posts SET thumb = $1 WHERE id = $2", [thumb, postId]);
  } catch {
    // the media route falls back to resizing on demand
  }
}

/** Only a real data URL is ever stored as an image. The client echoes the media URL of an
 *  unchanged image back on edit; storing that string would destroy the picture. */
function asDataImage(value) {
  const text = typeof value === "string" ? value : "";
  return text.startsWith("data:image/") ? text : "";
}

async function countPinned(db, ownerUserId, exceptId = 0) {
  const row = await get(db, "SELECT COUNT(*) AS c FROM posts WHERE owner_user_id = $1 AND featured AND id <> $2", [ownerUserId, exceptId]);
  return Number(row?.c || 0);
}

/** Keeps salons.post_count (public posts) honest for every write path. No-op for artists. */
async function syncOwnerPostCount(db, ownerUserId) {
  await run(db, `
    UPDATE salons SET post_count = (
      SELECT COUNT(*) FROM posts WHERE owner_user_id = $1 AND is_public
    ) WHERE user_id = $1
  `, [ownerUserId]);
}

/**
 * Owner view lists everything (including private posts); the public view lists only
 * posts the owner made public. Pinned first, then newest.
 */
export async function listPostsByOwner(ownerUserId, runner = null, { publicOnly = false } = {}) {
  const db = runner || (await getDb());
  const rows = await all(db, `
    ${postSelect}
    WHERE p.owner_user_id = $1 ${publicOnly ? "AND p.is_public" : ""}
    ORDER BY p.featured DESC, p.created_at DESC, p.id DESC
  `, [ownerUserId]);
  return rows.map(mapPost);
}

export async function getPostById(id, runner = null) {
  const db = runner || (await getDb());
  return mapPost(await get(db, `${postSelect} WHERE p.id = $1`, [id]));
}

/** A post a given viewer may see: public ones, or the viewer's own. */
export async function getVisiblePost(id, viewerUserId = null, runner = null) {
  const post = await getPostById(id, runner);
  if (!post) return null;
  if (post.isPublic || (viewerUserId && Number(viewerUserId) === Number(post.ownerUserId))) return post;
  return null;
}

/**
 * Count a view at most once per viewer per day, never for the owner, and only for
 * posts the viewer can actually see. Returns the post (with current counts) or null.
 */
export async function recordPostView(id, viewerKey, viewerUserId = null) {
  const db = await getDb();
  const post = await getVisiblePost(id, viewerUserId, db);
  if (!post) return null;
  if (viewerUserId && Number(viewerUserId) === Number(post.ownerUserId)) return post;
  const inserted = await run(db, `
    INSERT INTO post_views (post_id, viewer_key) VALUES ($1, $2)
    ON CONFLICT (post_id, viewer_key, day) DO NOTHING
  `, [id, String(viewerKey).slice(0, 80)]);
  if (inserted.rowCount > 0) {
    await run(db, "UPDATE posts SET views_count = views_count + 1 WHERE id = $1", [id]);
    return getPostById(id, db);
  }
  return post;
}

/**
 * `options.defer(fn)` lets a caller (the API route) run the slow, best-effort
 * external-storage upload after the response has been sent instead of making the
 * user wait for it -- the media route serves from the DB copy, so the post is
 * fully usable the moment the row is inserted.
 */
export async function createPost(ownerUserId, data, runner = null, options = {}) {
  const db = runner || (await getDb());
  const image = asDataImage(data.image);
  const pinned = Boolean(data.featured) && (await countPinned(db, ownerUserId)) < POST_LIMITS.pinned;
  const info = await run(db, `
    INSERT INTO posts (owner_user_id, title, tag, image, caption, is_public, featured)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [
    ownerUserId,
    clip(data.title, POST_LIMITS.title),
    clip(data.tag, POST_LIMITS.tag),
    image,
    clip(data.caption, POST_LIMITS.caption),
    data.isPublic !== false,
    pinned
  ]);
  const postId = Number(info.rows[0].id);
  await syncOwnerPostCount(db, ownerUserId);
  // Best-effort dual-write to external storage (see app/lib/storage.js).
  if (image) {
    const storeImage = async () => {
      await storeThumb(db, postId, image);
      const imageUrl = await uploadImageDataUrl(image, { kind: "post", ownerId: postId });
      if (imageUrl) {
        await run(db, "UPDATE posts SET image_url = $1 WHERE id = $2", [imageUrl, postId]);
      }
    };
    if (options.defer) options.defer(storeImage);
    else await storeImage();
  }
  return getPostById(postId, db);
}

export async function updatePost(id, ownerUserId, data, runner = null, options = {}) {
  const db = runner || (await getDb());
  const current = await get(db, "SELECT * FROM posts WHERE id = $1 AND owner_user_id = $2", [id, ownerUserId]);
  if (!current) return null;

  // A new picture only counts when it is a real data URL that differs from the stored one.
  const nextImage = asDataImage(data.image);
  const imageChanged = Boolean(nextImage) && nextImage !== current.image;
  const imageUrl = imageChanged ? null : current.image_url; // stale until the upload below lands

  const title = data.title === undefined ? current.title : clip(data.title, POST_LIMITS.title);
  const wantPinned = data.featured === undefined ? Boolean(current.featured) : Boolean(data.featured);
  const pinned = wantPinned && (current.featured || (await countPinned(db, ownerUserId, id)) < POST_LIMITS.pinned);

  await run(db, `
    UPDATE posts SET
      title = $1, tag = $2, image = $3, image_url = $4, caption = $5, is_public = $6, featured = $7,
      thumb = CASE WHEN $10 THEN '' ELSE thumb END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $8 AND owner_user_id = $9
  `, [
    title || current.title,
    data.tag === undefined ? current.tag : clip(data.tag, POST_LIMITS.tag),
    imageChanged ? nextImage : current.image,
    imageUrl,
    data.caption === undefined ? current.caption : clip(data.caption, POST_LIMITS.caption),
    data.isPublic === undefined ? current.is_public : Boolean(data.isPublic),
    pinned,
    id,
    ownerUserId,
    imageChanged
  ]);
  await syncOwnerPostCount(db, ownerUserId);
  if (imageChanged) {
    const storeImage = async () => {
      await storeThumb(db, id, nextImage);
      const uploaded = await uploadImageDataUrl(nextImage, { kind: "post", ownerId: id });
      if (uploaded) {
        await run(db, "UPDATE posts SET image_url = $1 WHERE id = $2 AND owner_user_id = $3", [uploaded, id, ownerUserId]);
      }
    };
    if (options.defer) options.defer(storeImage);
    else await storeImage();
  }
  return getPostById(id, db);
}

export async function deletePost(id, ownerUserId, runner = null) {
  const db = runner || (await getDb());
  const result = await run(db, "DELETE FROM posts WHERE id = $1 AND owner_user_id = $2", [id, ownerUserId]);
  if (result.rowCount > 0) await syncOwnerPostCount(db, ownerUserId);
  return result.rowCount > 0;
}

/**
 * Save / unsave in one transaction. `desired` (true/false) makes the call idempotent --
 * a double tap or a retry cannot flip the state back; omit it to toggle. saves_count is
 * recomputed from post_saves so it can never drift. Returns null when the post does not
 * exist or the user may not see it.
 */
export async function setSave(userId, postId, desired = undefined) {
  const db = await getDb();
  const post = await getVisiblePost(postId, userId, db);
  if (!post) return null;
  return withTransaction(db, async (tx) => {
    const existing = await get(tx, "SELECT 1 FROM post_saves WHERE user_id = $1 AND post_id = $2", [userId, postId]);
    const want = desired === undefined ? !existing : Boolean(desired);
    if (want && !existing) {
      await run(tx, "INSERT INTO post_saves (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [userId, postId]);
    } else if (!want && existing) {
      await run(tx, "DELETE FROM post_saves WHERE user_id = $1 AND post_id = $2", [userId, postId]);
    }
    const counted = await get(tx, `
      UPDATE posts SET saves_count = (SELECT COUNT(*) FROM post_saves WHERE post_id = $1)
      WHERE id = $1 RETURNING saves_count
    `, [postId]);
    return { saved: want, savesCount: Number(counted?.saves_count || 0) };
  });
}

/** Kept for callers that still toggle. */
export async function toggleSave(userId, postId) {
  return setSave(userId, postId);
}

/** The user's saved posts, newest save first. */
export async function listSavedPosts(userId) {
  const db = await getDb();
  const rows = await all(db, `
    ${postSelect}
    JOIN post_saves s ON s.post_id = p.id AND s.user_id = $1
    WHERE p.is_public OR p.owner_user_id = $1
    ORDER BY s.created_at DESC
  `, [userId]);
  return rows.map(mapPost);
}
