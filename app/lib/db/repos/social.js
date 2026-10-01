import { getDb, all, get, run } from "../connection.js";

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
  if (existing) {
    await run(db, "DELETE FROM follows WHERE follower_user_id = $1 AND target_user_id = $2", [followerUserId, targetUserId]);
    following = false;
  } else {
    await run(db, `
      INSERT INTO follows (follower_user_id, target_user_id) VALUES ($1, $2)
      ON CONFLICT (follower_user_id, target_user_id) DO NOTHING
    `, [followerUserId, targetUserId]);
  }
  const count = await get(db, "SELECT COUNT(*) AS c FROM follows WHERE target_user_id = $1", [targetUserId]);
  const followerCount = Number(count?.c || 0);
  // Keep denormalized salon counter in sync when target is a salon
  await run(db, "UPDATE salons SET follower_count = $1 WHERE user_id = $2", [followerCount, targetUserId]);
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
