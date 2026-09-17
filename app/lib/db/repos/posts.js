import { getDb } from "../connection.js";

function mapPost(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    tag: row.tag || "",
    image: row.image || "",
    caption: row.caption || "",
    inExplore: Boolean(row.in_explore),
    featured: Boolean(row.featured),
    saves: String(row.saves_count || 0),
    views: String(row.views_count || 0),
    comments: String(row.comments_count || 0),
    rating: row.rating_count ? String(Number(row.rating_avg).toFixed(1)) : "",
    salon: row.owner_name || "",
    ownerType: row.owner_type || "",
    ownerAvatar: row.owner_avatar || "",
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

export function ratePost(userId, postId, rating, comment) {
  const db = getDb();
  const value = Math.max(1, Math.min(5, Number(rating) || 0));
  const text = String(comment || "").trim().slice(0, 300);
  db.prepare(`
    INSERT INTO post_ratings (user_id, post_id, rating, comment)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, post_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, updated_at = CURRENT_TIMESTAMP
  `).run(userId, postId, value, text);
  const agg = db.prepare(`
    SELECT AVG(rating) AS avg_rating, COUNT(*) AS cnt FROM post_ratings WHERE post_id = ?
  `).get(postId);
  db.prepare(`
    UPDATE posts SET rating_avg = ?, rating_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(Number(agg?.avg_rating || 0), Number(agg?.cnt || 0), postId);
  return getPostById(postId);
}

export function listPostComments(postId) {
  return getDb().prepare(`
    SELECT r.user_id, u.name, r.rating, r.comment, r.updated_at
    FROM post_ratings r
    JOIN users u ON u.id = r.user_id
    WHERE r.post_id = ? AND TRIM(r.comment) != ''
    ORDER BY r.updated_at DESC
  `).all(postId).map((row) => ({
    user_id: row.user_id,
    name: row.name || "کاربر",
    rating: Number(row.rating),
    comment: row.comment,
    updated_at: row.updated_at
  }));
}

export function listUserRatings(userId) {
  const rows = getDb().prepare(`
    SELECT p.id, p.title, r.rating FROM post_ratings r
    JOIN posts p ON p.id = r.post_id
    WHERE r.user_id = ?
  `).all(userId);
  const map = {};
  rows.forEach((row) => {
    map[row.title] = row.rating;
    map[String(row.id)] = row.rating;
  });
  return map;
}
