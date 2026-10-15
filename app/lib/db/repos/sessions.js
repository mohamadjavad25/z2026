import { createHash } from "node:crypto";
import { getDb, get, run } from "../connection.js";

// The cookie carries the real, high-entropy token; only its sha256 ever touches the
// database -- same reasoning admin_sessions already applies (app/lib/adminAuth.js
// token_hash) so a leaked DB snapshot/backup can't be replayed as a live session.
// This is a one-way, un-keyed hash purely to avoid storing the bearer token verbatim,
// not a password hash: the token itself is already a large random value (see
// createSessionForUser in app/lib/auth.js), so a fast hash is the right tool here.
function hashToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

export async function createSession(token, userId, expiresAt) {
  const db = await getDb();
  await run(db, `
    INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)
  `, [hashToken(token), userId, new Date(expiresAt).toISOString()]);
}

export async function getValidSession(token) {
  const db = await getDb();
  const row = await get(db, `
    SELECT * FROM sessions
    WHERE token = $1 AND expires_at > NOW()
  `, [hashToken(token)]);
  return row || null;
}

export async function deleteSession(token) {
  const db = await getDb();
  await run(db, "DELETE FROM sessions WHERE token = $1", [hashToken(token)]);
}

export async function deleteUserSessions(userId) {
  const db = await getDb();
  await run(db, "DELETE FROM sessions WHERE user_id = $1", [userId]);
}

/**
 * Session -> user in ONE round trip, for the per-request auth check.
 * The users table stores avatar/poster as (often multi-MB) base64 text; callers
 * of this only need to know whether one exists (publicUser turns it into a media
 * URL), so the flag is returned in their place instead of the bytes.
 */
export async function getSessionUser(token) {
  const db = await getDb();
  const row = await get(db, `
    SELECT u.id, u.phone, u.password_hash, u.type, u.name, u.area, u.service, u.email,
           CASE WHEN u.avatar <> '' OR u.avatar_url IS NOT NULL THEN '1' ELSE '' END AS avatar,
           CASE WHEN u.poster <> '' OR u.poster_url IS NOT NULL THEN '1' ELSE '' END AS poster,
           u.avatar_position, u.poster_position, u.experience_years, u.manager_name,
           u.last_seen_at, u.created_at, u.updated_at, u.avatar_url, u.poster_url
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = $1 AND s.expires_at > NOW() AND u.suspended_at IS NULL
  `, [hashToken(token)]);
  return row || null;
}
