import { getDb, all, get, run } from "../connection.js";
import { notifyConnection } from "../../connectionNotify.js";
import { getUserLiteById } from "./users.js";

/**
 * Inserts the follow row; true only when this call created it (a repeat or a
 * concurrent double-click hits ON CONFLICT and returns false), so the owner is
 * told about a new follower exactly once.
 */
export async function insertFollow(runner, followerUserId, targetUserId) {
  const result = await run(runner, `
    INSERT INTO follows (follower_user_id, target_user_id) VALUES ($1, $2)
    ON CONFLICT (follower_user_id, target_user_id) DO NOTHING
  `, [followerUserId, targetUserId]);
  return result.rowCount > 0;
}

/** A follow is a contact: the salon or artist hears about it at once (best-effort push). */
export async function notifyNewFollower(followerUserId, targetUserId) {
  try {
    const follower = await getUserLiteById(followerUserId);
    const name = String(follower?.name || "").trim();
    notifyConnection(targetUserId, {
      title: "مشتری تازه به جمعتان پیوست",
      body: name ? `${name} شما را دنبال کرد و به مشتریان‌تان اضافه شد.` : "یک نفر شما را دنبال کرد و به مشتریان‌تان اضافه شد.",
      url: "/"
    });
  } catch {
    // The follow itself already succeeded; a missing push must never undo it.
  }
}

/**
 * Check-then-act (SELECT then DELETE/INSERT) with no transaction wrapper,
 * same as toggleSaveProfile below -- but until this fix, the INSERT branch
 * had no ON CONFLICT guard, unlike toggleSaveProfile's. Two truly
 * concurrent follow-clicks (double-click, two tabs, a retried request)
 * could both pass the SELECT seeing "not following yet" and both attempt
 * INSERT INTO follows -- the second lost the composite-PK race with an
 * uncaught duplicate-key error (no try/catch on this route), surfacing as
 * an unstructured 500 instead of the idempotent toggle a "follow" button
 * needs. ON CONFLICT DO NOTHING closes that the same way
 * toggleSaveProfile's already did.
 */
export async function toggleFollow(followerUserId, targetUserId) {
  if (followerUserId === targetUserId) return { ok: false, error: "self" };
  const db = await getDb();
  const existing = await get(db, `
    SELECT 1 FROM follows WHERE follower_user_id = $1 AND target_user_id = $2
  `, [followerUserId, targetUserId]);
  let following = true;
  let created = false;
  if (existing) {
    await run(db, "DELETE FROM follows WHERE follower_user_id = $1 AND target_user_id = $2", [followerUserId, targetUserId]);
    following = false;
  } else {
    created = await insertFollow(db, followerUserId, targetUserId);
  }
  const count = await get(db, "SELECT COUNT(*) AS c FROM follows WHERE target_user_id = $1", [targetUserId]);
  const followerCount = Number(count?.c || 0);
  // Keep denormalized salon counter in sync when target is a salon
  await run(db, "UPDATE salons SET follower_count = $1 WHERE user_id = $2", [followerCount, targetUserId]);
  if (created) notifyNewFollower(followerUserId, targetUserId);
  return { following, followerCount, follower_count: followerCount };
}

export async function listFollowingIds(followerUserId) {
  const db = await getDb();
  const rows = await all(db, `
    SELECT target_user_id FROM follows WHERE follower_user_id = $1
  `, [followerUserId]);
  return rows.map((row) => row.target_user_id);
}

/**
 * Real (server-side) save/unsave of a salon or independent artist's public
 * profile — the bookmark button on their page. Target must be an existing
 * salon or artist `users` row (checked by the caller before this runs).
 * Mirrors toggleFollow's shape/self-check; check-then-insert/delete used to
 * run synchronously on node:sqlite's single-threaded connection so a rapid
 * double-click couldn't interleave and duplicate/desync a row -- on Postgres
 * the INSERT below uses ON CONFLICT DO NOTHING (equivalent to the old
 * `INSERT OR IGNORE`) to keep that same idempotent-toggle guarantee even
 * across concurrent connections.
 */
export async function toggleSaveProfile(userId, targetUserId) {
  if (userId === targetUserId) return { ok: false, error: "self" };
  const db = await getDb();
  const existing = await get(db, `
    SELECT 1 FROM saved_profiles WHERE user_id = $1 AND target_user_id = $2
  `, [userId, targetUserId]);
  let saved;
  if (existing) {
    await run(db, "DELETE FROM saved_profiles WHERE user_id = $1 AND target_user_id = $2", [userId, targetUserId]);
    saved = false;
  } else {
    await run(db, `
      INSERT INTO saved_profiles (user_id, target_user_id) VALUES ($1, $2)
      ON CONFLICT (user_id, target_user_id) DO NOTHING
    `, [userId, targetUserId]);
    saved = true;
  }
  return { ok: true, saved, targetUserId };
}

export async function listSavedProfileIds(userId) {
  const db = await getDb();
  const rows = await all(db, `
    SELECT target_user_id FROM saved_profiles WHERE user_id = $1
  `, [userId]);
  return rows.map((row) => row.target_user_id);
}

export async function isProfileSaved(userId, targetUserId, runner = null) {
  if (!userId) return false;
  const db = runner || (await getDb());
  return Boolean(await get(db, `
    SELECT 1 FROM saved_profiles WHERE user_id = $1 AND target_user_id = $2
  `, [userId, targetUserId]));
}

/**
 * Followers of a salon or artist, newest first, with what the owner needs to
 * reach them: the follower's own account name and phone. `is_new` is true until
 * the owner opens the customers page (markFollowersSeen); `has_booked` is true
 * once the follower has any booking with this owner (by account or by phone),
 * so a follower who has not booked yet can be told apart and invited to.
 */
export async function listFollowersForOwner(ownerUserId, { limit = 100 } = {}) {
  const db = await getDb();
  const rows = await all(db, `
    SELECT f.follower_user_id AS user_id, f.created_at, f.seen_at,
           u.name, u.phone, (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS has_avatar,
           (
             EXISTS (SELECT 1 FROM salon_bookings b WHERE b.salon_user_id = $1 AND (b.client_user_id = f.follower_user_id OR (u.phone <> '' AND b.phone_normalized = u.phone)))
             OR EXISTS (SELECT 1 FROM artist_bookings b WHERE b.artist_user_id = $1 AND (b.client_user_id = f.follower_user_id OR (u.phone <> '' AND b.phone_normalized = u.phone)))
           ) AS has_booked
    FROM follows f
    JOIN users u ON u.id = f.follower_user_id
    WHERE f.target_user_id = $1
    ORDER BY f.created_at DESC
    LIMIT $2
  `, [ownerUserId, Math.min(Math.max(Number(limit) || 100, 1), 500)]);
  return rows.map((row) => ({
    userId: Number(row.user_id),
    name: row.name || "",
    phone: row.phone || "",
    hasAvatar: Boolean(row.has_avatar),
    followedAt: row.created_at,
    isNew: !row.seen_at,
    hasBooked: Boolean(row.has_booked)
  }));
}

export async function countUnseenFollowers(ownerUserId) {
  const db = await getDb();
  const row = await get(db, "SELECT COUNT(*) AS c FROM follows WHERE target_user_id = $1 AND seen_at IS NULL", [ownerUserId]);
  return Number(row?.c || 0);
}

/** The owner opened the customers page: everyone who followed so far stops being "new". */
export async function markFollowersSeen(ownerUserId) {
  const db = await getDb();
  const result = await run(db, "UPDATE follows SET seen_at = CURRENT_TIMESTAMP WHERE target_user_id = $1 AND seen_at IS NULL", [ownerUserId]);
  return result.rowCount;
}
