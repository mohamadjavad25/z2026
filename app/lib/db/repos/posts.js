import { getDb, all, get, run } from "../connection.js";

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

export async function listExplorePosts({ tag } = {}, runner = null) {
  const db = runner || (await getDb());
  if (tag && tag !== "همه") {
    const rows = await all(db, `
      ${postSelect}
      WHERE p.in_explore = 1 AND p.tag = ?
      ORDER BY p.featured DESC, p.created_at DESC
    `, [tag]);
    return rows.map(mapPost);
  }
  const rows = await all(db, `
    ${postSelect}
    WHERE p.in_explore = 1
    ORDER BY p.featured DESC, p.created_at DESC
  `);
  return rows.map(mapPost);
}

export async function listPostsByOwner(ownerUserId, runner = null) {
  const db = runner || (await getDb());
  const rows = await all(db, `
    ${postSelect}
    WHERE p.owner_user_id = ?
    ORDER BY p.featured DESC, p.created_at DESC
  `, [ownerUserId]);
  return rows.map(mapPost);
}

export async function getPostById(id, runner = null) {
  const db = runner || (await getDb());
  return mapPost(await get(db, `${postSelect} WHERE p.id = ?`, [id]));
}

export async function incrementPostViews(id) {
  const db = await getDb();
  await run(db, `
    UPDATE posts SET views_count = views_count + 1 WHERE id = ?
  `, [id]);
  return getPostById(id, db);
}

export async function createPost(ownerUserId, data, runner = null) {
  const db = runner || (await getDb());
  const info = await run(db, `
    INSERT INTO posts (owner_user_id, title, tag, image, caption, in_explore, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `, [
    ownerUserId,
    data.title || "",
    data.tag || "",
    data.image || "",
    data.caption || "",
    data.inExplore === false ? 0 : 1,
    data.featured ? 1 : 0
  ]);
  return getPostById(Number(info.rows[0].id), db);
}

export async function updatePost(id, ownerUserId, data, runner = null) {
  const db = runner || (await getDb());
  const current = await get(db, "SELECT * FROM posts WHERE id = ? AND owner_user_id = ?", [id, ownerUserId]);
  if (!current) return null;
  await run(db, `
    UPDATE posts SET
      title = ?, tag = ?, image = ?, caption = ?, in_explore = ?, featured = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND owner_user_id = ?
  `, [
    data.title ?? current.title,
    data.tag ?? current.tag,
    data.image ?? current.image,
    data.caption ?? current.caption,
    data.inExplore === undefined ? current.in_explore : (data.inExplore ? 1 : 0),
    data.featured === undefined ? current.featured : (data.featured ? 1 : 0),
    id,
    ownerUserId
  ]);
  return getPostById(id, db);
}

export async function deletePost(id, ownerUserId, runner = null) {
  const db = runner || (await getDb());
  const result = await run(db, "DELETE FROM posts WHERE id = ? AND owner_user_id = ?", [id, ownerUserId]);
  return result.changes > 0;
}

export async function toggleSave(userId, postId) {
  const db = await getDb();
  const existing = await get(db, "SELECT 1 FROM post_saves WHERE user_id = ? AND post_id = ?", [userId, postId]);
  if (existing) {
    await run(db, "DELETE FROM post_saves WHERE user_id = ? AND post_id = ?", [userId, postId]);
    await run(db, "UPDATE posts SET saves_count = GREATEST(saves_count - 1, 0) WHERE id = ?", [postId]);
    return { saved: false };
  }
  await run(db, "INSERT INTO post_saves (user_id, post_id) VALUES (?, ?)", [userId, postId]);
  await run(db, "UPDATE posts SET saves_count = saves_count + 1 WHERE id = ?", [postId]);
  return { saved: true };
}

export async function listSavedTitles(userId) {
  const db = await getDb();
  const rows = await all(db, `
    SELECT p.id FROM post_saves s
    JOIN posts p ON p.id = s.post_id
    WHERE s.user_id = ?
    ORDER BY s.created_at DESC
  `, [userId]);
  return rows.map((row) => String(row.id)).filter(Boolean);
}
