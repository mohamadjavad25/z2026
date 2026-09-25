import { getDb } from "../connection.js";

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
    u.area AS owner_area,
    u.bio AS owner_bio,
    u.service AS owner_service
  FROM posts p
  JOIN users u ON u.id = p.owner_user_id
`;

export function listExplorePosts({ tag } = {}) {
  if (tag && tag !== "همه") {
    return getDb().prepare(`
      ${postSelect}
      WHERE p.in_explore = 1 AND p.tag = ?
      ORDER BY p.featured DESC, p.created_at DESC
    `).all(tag).map(mapPost);
  }
  return getDb().prepare(`
    ${postSelect}
    WHERE p.in_explore = 1
    ORDER BY p.featured DESC, p.created_at DESC
  `).all().map(mapPost);
}

export function listPostsByOwner(ownerUserId) {
  return getDb().prepare(`
    ${postSelect}
    WHERE p.owner_user_id = ?
    ORDER BY p.featured DESC, p.created_at DESC
  `).all(ownerUserId).map(mapPost);
}

export function getPostById(id) {
  return mapPost(getDb().prepare(`${postSelect} WHERE p.id = ?`).get(id));
}

export function incrementPostViews(id) {
  getDb().prepare(`
    UPDATE posts SET views_count = views_count + 1 WHERE id = ?
  `).run(id);
  return getPostById(id);
}

export function createPost(ownerUserId, data) {
  const info = getDb().prepare(`
    INSERT INTO posts (owner_user_id, title, tag, image, caption, in_explore, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    ownerUserId,
    data.title || "",
    data.tag || "",
    data.image || "",
    data.caption || "",
    data.inExplore === false ? 0 : 1,
    data.featured ? 1 : 0
  );
  return getPostById(Number(info.lastInsertRowid));
}

export function updatePost(id, ownerUserId, data) {
  const current = getDb().prepare("SELECT * FROM posts WHERE id = ? AND owner_user_id = ?").get(id, ownerUserId);
  if (!current) return null;
  getDb().prepare(`
    UPDATE posts SET
      title = ?, tag = ?, image = ?, caption = ?, in_explore = ?, featured = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND owner_user_id = ?
  `).run(
    data.title ?? current.title,
    data.tag ?? current.tag,
    data.image ?? current.image,
    data.caption ?? current.caption,
    data.inExplore === undefined ? current.in_explore : (data.inExplore ? 1 : 0),
    data.featured === undefined ? current.featured : (data.featured ? 1 : 0),
    id,
    ownerUserId
  );
  return getPostById(id);
}

export function deletePost(id, ownerUserId) {
  const result = getDb().prepare("DELETE FROM posts WHERE id = ? AND owner_user_id = ?").run(id, ownerUserId);
  return result.changes > 0;
}

export function toggleSave(userId, postId) {
  const db = getDb();
  const existing = db.prepare("SELECT 1 FROM post_saves WHERE user_id = ? AND post_id = ?").get(userId, postId);
  if (existing) {
    db.prepare("DELETE FROM post_saves WHERE user_id = ? AND post_id = ?").run(userId, postId);
    db.prepare("UPDATE posts SET saves_count = MAX(saves_count - 1, 0) WHERE id = ?").run(postId);
    return { saved: false };
  }
  db.prepare("INSERT INTO post_saves (user_id, post_id) VALUES (?, ?)").run(userId, postId);
  db.prepare("UPDATE posts SET saves_count = saves_count + 1 WHERE id = ?").run(postId);
  return { saved: true };
}

export function listSavedTitles(userId) {
  return getDb().prepare(`
    SELECT p.id FROM post_saves s
    JOIN posts p ON p.id = s.post_id
    WHERE s.user_id = ?
    ORDER BY s.created_at DESC
  `).all(userId).map((row) => String(row.id)).filter(Boolean);
}

