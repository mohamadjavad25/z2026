import { getDb } from "../connection.js";

export function listReviews(targetUserId, viewerUserId = null) {
  return getDb().prepare(`
    SELECT r.id, r.author_user_id, r.author_name AS name, r.rating, r.text, r.service, r.created_at, r.reply_text, r.replied_at,
           u.type AS author_type, u.avatar AS author_avatar, u.area AS author_area,
           (SELECT COUNT(*) FROM review_likes rl WHERE rl.review_id = r.id) AS like_count,
           EXISTS(SELECT 1 FROM review_likes rl2 WHERE rl2.review_id = r.id AND rl2.user_id = ?) AS liked_by_me
    FROM reviews r
    LEFT JOIN users u ON u.id = r.author_user_id
    WHERE r.target_user_id = ?
    ORDER BY r.id DESC
  `).all(viewerUserId || 0, targetUserId);
}

export function toggleReviewLike(reviewId, userId) {
  const db = getDb();
  const review = db.prepare("SELECT id FROM reviews WHERE id = ?").get(reviewId);
  if (!review) return { ok: false, error: "نظر پیدا نشد." };

  const existing = db.prepare(
    "SELECT 1 FROM review_likes WHERE review_id = ? AND user_id = ?"
  ).get(reviewId, userId);

  let liked;
  if (existing) {
    db.prepare("DELETE FROM review_likes WHERE review_id = ? AND user_id = ?").run(reviewId, userId);
    liked = false;
  } else {
    db.prepare("INSERT INTO review_likes (review_id, user_id) VALUES (?, ?)").run(reviewId, userId);
    liked = true;
  }

  const count = db.prepare("SELECT COUNT(*) AS c FROM review_likes WHERE review_id = ?").get(reviewId);
  return { ok: true, liked, likeCount: Number(count?.c || 0) };
}

export function replyToReview({ reviewId, targetUserId, replyText }) {
  const db = getDb();
  const review = db.prepare("SELECT id, target_user_id FROM reviews WHERE id = ?").get(reviewId);
  if (!review) return { ok: false, error: "نظر پیدا نشد." };
  if (Number(review.target_user_id) !== Number(targetUserId)) {
    return { ok: false, error: "دسترسی غیرمجاز." };
  }
  const text = replyText == null ? "" : String(replyText).trim();
  db.prepare(`
    UPDATE reviews SET reply_text = ?, replied_at = ? WHERE id = ?
  `).run(text, text ? new Date().toISOString() : null, reviewId);
  return {
    ok: true,
    review: db.prepare(`
      SELECT r.id, r.author_user_id, r.author_name AS name, r.rating, r.text, r.service, r.created_at, r.reply_text, r.replied_at,
             u.type AS author_type, u.avatar AS author_avatar, u.area AS author_area
      FROM reviews r
      LEFT JOIN users u ON u.id = r.author_user_id
      WHERE r.id = ?
    `).get(reviewId)
  };
}

export function getTargetRatingSummary(targetUserId) {
  const ratingAgg = getDb().prepare(`
    SELECT AVG(rating) AS avg_rating, COUNT(*) AS cnt FROM reviews WHERE target_user_id = ?
  `).get(targetUserId);
  return {
    rating: ratingAgg?.cnt ? Number(ratingAgg.avg_rating).toFixed(1) : "۰",
    reviewCount: Number(ratingAgg?.cnt || 0)
  };
}

export function addReview({ targetUserId, authorUserId, authorName, rating, text, service }) {
  const db = getDb();
  const value = Math.max(1, Math.min(5, Number(rating) || 0));
  const nextText = text == null ? "" : String(text);
  const nextService = service == null ? "" : String(service);
  const nextName = authorName || "";

  if (authorUserId) {
    const existing = db.prepare(`
      SELECT id, text, service FROM reviews
      WHERE target_user_id = ? AND author_user_id = ?
      ORDER BY id DESC LIMIT 1
    `).get(targetUserId, authorUserId);

    if (existing) {
      db.prepare(`
        UPDATE reviews
        SET rating = ?,
            text = ?,
            service = ?,
            author_name = ?
        WHERE id = ?
      `).run(
        value,
        nextText !== "" ? nextText : (existing.text || ""),
        nextService !== "" ? nextService : (existing.service || ""),
        nextName,
        existing.id
      );
      return db.prepare("SELECT * FROM reviews WHERE id = ?").get(existing.id);
    }
  }

  const info = db.prepare(`
    INSERT INTO reviews (target_user_id, author_user_id, author_name, rating, text, service)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    targetUserId,
    authorUserId || null,
    nextName,
    value,
    nextText,
    nextService
  );
  return db.prepare("SELECT * FROM reviews WHERE id = ?").get(Number(info.lastInsertRowid));
}

export function toggleFollow(followerUserId, targetUserId) {
  if (followerUserId === targetUserId) return { ok: false, error: "self" };
  const db = getDb();
  const existing = db.prepare(`
    SELECT 1 FROM follows WHERE follower_user_id = ? AND target_user_id = ?
  `).get(followerUserId, targetUserId);
  let following = true;
  if (existing) {
    db.prepare("DELETE FROM follows WHERE follower_user_id = ? AND target_user_id = ?").run(followerUserId, targetUserId);
    following = false;
  } else {
    db.prepare("INSERT INTO follows (follower_user_id, target_user_id) VALUES (?, ?)").run(followerUserId, targetUserId);
  }
  const count = db.prepare("SELECT COUNT(*) AS c FROM follows WHERE target_user_id = ?").get(targetUserId);
  const followerCount = Number(count?.c || 0);
  // Keep denormalized salon counter in sync when target is a salon
  db.prepare("UPDATE salons SET follower_count = ? WHERE user_id = ?").run(followerCount, targetUserId);
  return { following, followerCount, follower_count: followerCount };
}

export function listFollowingIds(followerUserId) {
  return getDb().prepare(`
    SELECT target_user_id FROM follows WHERE follower_user_id = ?
  `).all(followerUserId).map((row) => row.target_user_id);
}
