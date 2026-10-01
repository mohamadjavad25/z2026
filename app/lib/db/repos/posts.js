import { getDb, all, get, run } from "../connection.js";
import { uploadImageDataUrl } from "../../storage.js";

// Both image/ownerAvatar are stored as raw data:<type>;base64,<data> strings
// in the DB but shipped here as media-endpoint URLs, never inline -- this
// mapper is the single choke point for every post list (explore feed, a
// salon/artist's portfolio via listSalonPortfolio -> listPostsByOwner), so
// embedding the raw base64 here was why a 5-post explore feed shipped
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
    image: row.image ? `/api/media/post/${row.id}` : "",
    caption: row.caption || "",
    inExplore: Boolean(row.in_explore),
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
  SELECT p.*,
    u.name AS owner_name,
    u.type AS owner_type,
    u.avatar AS owner_avatar,
    u.avatar_position AS owner_avatar_position,
    u.area AS owner_area,
    u.bio AS owner_bio,
    u.service AS owner_service
  FROM posts p
  JOIN users u ON u.id = p.owner_user_id
`;

/**
 * Cursor-paginated when `limit` is given (GET /api/explore/posts); called
 * with no `limit` (any other internal caller) returns the full, unbounded
 * feed -- same opt-in-by-passing-limit convention as listSalons()/
 * listArtists().
 *
 * The feed sorts `featured DESC, created_at DESC` (featured posts always
 * first), so a plain `id < cursor` keyset isn't correct on its own -- a
 * non-featured post's id can be lower than a featured one that sorts
 * before it. Cursors instead on the same compound key it sorts by, using
 * Postgres row comparison `(p.featured, p.id) < (?, ?)` (id substitutes for
 * created_at as the tiebreaker -- both are monotonic with insertion order,
 * and id gives an exact, unique tiebreaker a timestamp isn't guaranteed to).
 * Encoded as a single opaque "1:123"/"0:123" string so route/frontend code
 * threads one cursor value, not two.
 */
export async function listExplorePosts({ tag, cursor, limit } = {}, runner = null) {
  const db = runner || (await getDb());
  const params = [];
  let where = "p.in_explore";
  if (tag && tag !== "همه") {
    params.push(tag);
    where += ` AND p.tag = $${params.length}`;
  }
  if (cursor) {
    const [cFeatured, cId] = String(cursor).split(":");
    params.push(cFeatured === "1", Number(cId) || 0);
    where += ` AND (p.featured, p.id) < ($${params.length - 1}, $${params.length})`;
  }
  let limitClause = "";
  const pageSize = limit ? Math.min(Math.max(Number(limit) || 20, 1), 50) : null;
  if (pageSize) {
    params.push(pageSize + 1);
    limitClause = `LIMIT $${params.length}`;
  }
  const rawRows = await all(db, `
    ${postSelect}
    WHERE ${where}
    ORDER BY p.featured DESC, p.id DESC
    ${limitClause}
  `, params);
  const hasMore = pageSize ? rawRows.length > pageSize : false;
  const rows = pageSize ? rawRows.slice(0, pageSize) : rawRows;
  const nextCursor = hasMore
    ? `${rows[rows.length - 1].featured ? 1 : 0}:${rows[rows.length - 1].id}`
    : null;
  const mapped = rows.map(mapPost);
  return pageSize ? { posts: mapped, nextCursor } : mapped;
}

export async function listPostsByOwner(ownerUserId, runner = null) {
  const db = runner || (await getDb());
  const rows = await all(db, `
    ${postSelect}
    WHERE p.owner_user_id = $1
    ORDER BY p.featured DESC, p.created_at DESC
  `, [ownerUserId]);
  return rows.map(mapPost);
}

export async function getPostById(id, runner = null) {
  const db = runner || (await getDb());
  return mapPost(await get(db, `${postSelect} WHERE p.id = $1`, [id]));
}

export async function incrementPostViews(id) {
  const db = await getDb();
  await run(db, `
    UPDATE posts SET views_count = views_count + 1 WHERE id = $1
  `, [id]);
  return getPostById(id, db);
}

export async function createPost(ownerUserId, data, runner = null) {
  const db = runner || (await getDb());
  const info = await run(db, `
    INSERT INTO posts (owner_user_id, title, tag, image, caption, in_explore, featured)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [
    ownerUserId,
    data.title || "",
    data.tag || "",
    data.image || "",
    data.caption || "",
    data.inExplore !== false,
    Boolean(data.featured)
  ]);
  const postId = Number(info.rows[0].id);
  // Dual-write to Supabase Storage (see app/lib/storage.js) -- same
  // best-effort, never-throws pattern as users.js's createUser/
  // updateUser. Covers both direct post creation (POST /api/posts) and
  // salon-portfolio uploads, since addSalonPortfolio routes through this
  // same function (see app/lib/db/repos/salons/portfolio.js).
  if (data.image) {
    const imageUrl = await uploadImageDataUrl(data.image, { kind: "post", ownerId: postId });
    if (imageUrl) {
      await run(db, "UPDATE posts SET image_url = $1 WHERE id = $2", [imageUrl, postId]);
    }
  }
  return getPostById(postId, db);
}

export async function updatePost(id, ownerUserId, data, runner = null) {
  const db = runner || (await getDb());
  const current = await get(db, "SELECT * FROM posts WHERE id = $1 AND owner_user_id = $2", [id, ownerUserId]);
  if (!current) return null;

  let imageUrl = current.image_url;
  if (data.image !== undefined && data.image !== current.image) {
    imageUrl = data.image ? await uploadImageDataUrl(data.image, { kind: "post", ownerId: id }) : null;
  }

  await run(db, `
    UPDATE posts SET
      title = $1, tag = $2, image = $3, image_url = $4, caption = $5, in_explore = $6, featured = $7,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $8 AND owner_user_id = $9
  `, [
    data.title ?? current.title,
    data.tag ?? current.tag,
    data.image ?? current.image,
    imageUrl,
    data.caption ?? current.caption,
    data.inExplore === undefined ? current.in_explore : Boolean(data.inExplore),
    data.featured === undefined ? current.featured : Boolean(data.featured),
    id,
    ownerUserId
  ]);
  return getPostById(id, db);
}

export async function deletePost(id, ownerUserId, runner = null) {
  const db = runner || (await getDb());
  const result = await run(db, "DELETE FROM posts WHERE id = $1 AND owner_user_id = $2", [id, ownerUserId]);
  return result.rowCount > 0;
}

/**
 * Same check-then-act race app/lib/db/repos/social.js's toggleFollow had:
 * two truly concurrent toggles (double-click, two tabs) could both pass the
 * SELECT and both attempt INSERT, the second losing the composite-PK race
 * with an uncaught duplicate-key error. Fixed the same way, with
 * ON CONFLICT DO NOTHING -- and since that means an INSERT/DELETE here can
 * now legitimately affect zero rows (a concurrent call already did it),
 * saves_count is only adjusted when result.rowCount confirms this call's
 * statement actually changed a row; otherwise two concurrent saves would
 * both increment the counter even though only one post_saves row exists.
 */
export async function toggleSave(userId, postId) {
  const db = await getDb();
  const existing = await get(db, "SELECT 1 FROM post_saves WHERE user_id = $1 AND post_id = $2", [userId, postId]);
  if (existing) {
    const result = await run(db, "DELETE FROM post_saves WHERE user_id = $1 AND post_id = $2", [userId, postId]);
    if (result.rowCount > 0) {
      await run(db, "UPDATE posts SET saves_count = GREATEST(saves_count - 1, 0) WHERE id = $1", [postId]);
    }
    return { saved: false };
  }
  const result = await run(db, `
    INSERT INTO post_saves (user_id, post_id) VALUES ($1, $2)
    ON CONFLICT (user_id, post_id) DO NOTHING
  `, [userId, postId]);
  if (result.rowCount > 0) {
    await run(db, "UPDATE posts SET saves_count = saves_count + 1 WHERE id = $1", [postId]);
  }
  return { saved: true };
}

export async function listSavedTitles(userId) {
  const db = await getDb();
  const rows = await all(db, `
    SELECT p.id FROM post_saves s
    JOIN posts p ON p.id = s.post_id
    WHERE s.user_id = $1
    ORDER BY s.created_at DESC
  `, [userId]);
  return rows.map((row) => String(row.id)).filter(Boolean);
}
