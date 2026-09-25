import { getDb } from "../connection.js";

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

/**
 * Real (server-side) save/unsave of a salon or independent artist's public
 * profile — the bookmark button on their page. Target must be an existing
 * salon or artist `users` row (checked by the caller before this runs).
 * Mirrors toggleFollow's shape/self-check; check-then-insert/delete runs
 * synchronously on node:sqlite's single-threaded connection, same as every
 * other toggle in this file, so a rapid double-click can't interleave and
 * duplicate/desync a row.
 */
export function toggleSaveProfile(userId, targetUserId) {
  if (userId === targetUserId) return { ok: false, error: "self" };
  const db = getDb();
  const existing = db.prepare(`
    SELECT 1 FROM saved_profiles WHERE user_id = ? AND target_user_id = ?
  `).get(userId, targetUserId);
  let saved;
  if (existing) {
    db.prepare("DELETE FROM saved_profiles WHERE user_id = ? AND target_user_id = ?").run(userId, targetUserId);
    saved = false;
  } else {
    db.prepare("INSERT OR IGNORE INTO saved_profiles (user_id, target_user_id) VALUES (?, ?)").run(userId, targetUserId);
    saved = true;
  }
  return { ok: true, saved, targetUserId };
}

export function listSavedProfileIds(userId) {
  return getDb().prepare(`
    SELECT target_user_id FROM saved_profiles WHERE user_id = ?
  `).all(userId).map((row) => row.target_user_id);
}

export function isProfileSaved(userId, targetUserId) {
  if (!userId) return false;
  return Boolean(getDb().prepare(`
    SELECT 1 FROM saved_profiles WHERE user_id = ? AND target_user_id = ?
  `).get(userId, targetUserId));
}
