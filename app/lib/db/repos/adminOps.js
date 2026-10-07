import { getDb, all, get, run } from "../connection.js";

const clamp = (value, min, max, fallback) => Math.min(Math.max(Number(value) || fallback, min), max);
const likeOf = (term) => {
  const text = String(term || "").trim();
  return text ? `%${text.replace(/[%_\\]/g, "\\$&")}%` : "";
};

/** One account for the admin detail view: profile fields (never the password hash or image bytes) plus counts and recent bookings. */
export async function getUserDetail(id) {
  const db = await getDb();
  const user = await get(db, `
    SELECT id, name, phone, email, type, area, service, bio, manager_name, experience_years, created_at, updated_at, last_seen_at, suspended_at,
           (avatar <> '' OR COALESCE(avatar_url, '') <> '') AS has_avatar
    FROM users WHERE id = $1
  `, [Number(id)]);
  if (!user) return null;
  const [counts, sessions, bookings] = await Promise.all([
    get(db, `
      SELECT
        (SELECT COUNT(*)::int FROM posts WHERE owner_user_id = $1) AS posts,
        (SELECT COUNT(*)::int FROM follows WHERE target_user_id = $1) AS followers,
        (SELECT COUNT(*)::int FROM salon_bookings WHERE client_user_id = $1 OR salon_user_id = $1)
          + (SELECT COUNT(*)::int FROM artist_bookings WHERE source_salon_user_id IS NULL AND (client_user_id = $1 OR artist_user_id = $1)) AS bookings
    `, [user.id]).catch(() => ({ posts: 0, followers: 0, bookings: 0 })),
    get(db, "SELECT COUNT(*)::int AS count FROM sessions WHERE user_id = $1 AND expires_at > NOW()", [user.id]).catch(() => ({ count: 0 })),
    all(db, `
      SELECT * FROM (
        SELECT 'salon' AS kind, b.id, b.service, b.booking_date, b.time, b.status, b.created_at FROM salon_bookings b WHERE b.client_user_id = $1 OR b.salon_user_id = $1
        UNION ALL
        SELECT 'artist', b.id, b.service, b.booking_date, b.time, b.status, b.created_at FROM artist_bookings b
        WHERE b.source_salon_user_id IS NULL AND (b.client_user_id = $1 OR b.artist_user_id = $1)
      ) x ORDER BY created_at DESC LIMIT 10
    `, [user.id])
  ]);
  return { user, counts: counts || {}, activeSessions: sessions?.count || 0, recentBookings: bookings };
}

export async function deleteUser(id) {
  const db = await getDb();
  const row = await get(db, "DELETE FROM users WHERE id = $1 RETURNING id, phone, name", [Number(id)]);
  return row || null;
}

export async function listPosts({ q = "", visibility = "", limit = 25, offset = 0 } = {}) {
  const db = await getDb();
  const like = likeOf(q);
  const vis = ["public", "hidden"].includes(visibility) ? visibility : "";
  const where = "($1 = '' OR p.title ILIKE $1 OR p.caption ILIKE $1 OR u.name ILIKE $1 OR u.phone LIKE $1) AND ($2 = '' OR ($2 = 'public' AND p.is_public) OR ($2 = 'hidden' AND NOT p.is_public))";
  const total = await get(db, `SELECT COUNT(*)::int AS count FROM posts p JOIN users u ON u.id = p.owner_user_id WHERE ${where}`, [like, vis]);
  const rows = await all(db, `
    SELECT p.id, p.title, p.tag, p.is_public, p.views_count, p.saves_count, p.created_at, u.id AS owner_id, u.name AS owner_name, u.phone AS owner_phone
    FROM posts p JOIN users u ON u.id = p.owner_user_id
    WHERE ${where} ORDER BY p.id DESC LIMIT $3 OFFSET $4
  `, [like, vis, clamp(limit, 1, 100, 25), Math.max(Number(offset) || 0, 0)]);
  return { total: total?.count || 0, posts: rows };
}

export async function setPostPublic(id, isPublic) {
  const db = await getDb();
  return (await get(db, "UPDATE posts SET is_public = $2, updated_at = NOW() WHERE id = $1 RETURNING id, title, owner_user_id, is_public", [Number(id), Boolean(isPublic)])) || null;
}

export async function deletePost(id) {
  const db = await getDb();
  return (await get(db, "DELETE FROM posts WHERE id = $1 RETURNING id, title, owner_user_id", [Number(id)])) || null;
}

/** Salon and artist bookings together (artist rows mirrored from a salon are skipped: they are the same booking), newest first. */
export async function listBookings({ q = "", status = "", limit = 25, offset = 0 } = {}) {
  const db = await getDb();
  const like = likeOf(q);
  const stat = String(status || "").slice(0, 40);
  const inner = `
    SELECT 'salon' AS kind, b.id, u.name AS provider, b.client, b.phone, b.service, b.booking_date, b.time, b.status, b.created_at
      FROM salon_bookings b LEFT JOIN users u ON u.id = b.salon_user_id
    UNION ALL
    SELECT 'artist', b.id, u.name, b.client_name, b.client_phone, b.service, b.booking_date, b.time, b.status, b.created_at
      FROM artist_bookings b LEFT JOIN users u ON u.id = b.artist_user_id WHERE b.source_salon_user_id IS NULL
  `;
  const where = "($1 = '' OR client ILIKE $1 OR phone LIKE $1 OR provider ILIKE $1 OR service ILIKE $1) AND ($2 = '' OR status = $2)";
  const total = await get(db, `SELECT COUNT(*)::int AS count FROM (${inner}) x WHERE ${where}`, [like, stat]);
  const rows = await all(db, `SELECT * FROM (${inner}) x WHERE ${where} ORDER BY created_at DESC LIMIT $3 OFFSET $4`, [like, stat, clamp(limit, 1, 100, 25), Math.max(Number(offset) || 0, 0)]);
  const statuses = await all(db, `SELECT status, COUNT(*)::int AS count FROM (${inner}) x GROUP BY status ORDER BY count DESC`);
  return { total: total?.count || 0, bookings: rows, statuses };
}

/** Login-related audit rows for the security tab. */
export async function listSecurityEvents(limit = 60) {
  const db = await getDb();
  return all(db, `
    SELECT id, admin_label, action, detail, created_at FROM admin_actions
    WHERE action IN ('login', 'login_failed', 'login_blocked', 'enroll', 'enroll_failed', 'stepup', 'stepup_failed', 'revoke_sessions', 'reset_authenticator')
    ORDER BY id DESC LIMIT $1
  `, [clamp(limit, 1, 200, 60)]);
}

export async function killUserSessions(userId) {
  const db = await getDb();
  await run(db, "DELETE FROM sessions WHERE user_id = $1", [Number(userId)]);
}
