import { getDb, all, get, run } from "../connection.js";

/** Numbers for the admin overview. Everything is counted in SQL; nothing here reads user content. */
export async function getOverview() {
  const db = await getDb();
  const [byType, suspended, signups, salonStatus, artistStatus, resets, reminders, bookingsToday] = await Promise.all([
    all(db, "SELECT type, COUNT(*)::int AS count FROM users GROUP BY type"),
    get(db, "SELECT COUNT(*)::int AS count FROM users WHERE suspended_at IS NOT NULL"),
    all(db, `
      SELECT to_char(d::date, 'YYYY-MM-DD') AS day, COALESCE(c.count, 0)::int AS count
      FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') AS d
      LEFT JOIN (SELECT created_at::date AS day, COUNT(*) AS count FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '13 days' GROUP BY 1) c ON c.day = d::date
      ORDER BY d
    `),
    all(db, "SELECT status, COUNT(*)::int AS count FROM salon_bookings WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY status"),
    all(db, "SELECT status, COUNT(*)::int AS count FROM artist_bookings WHERE source_salon_user_id IS NULL AND created_at >= NOW() - INTERVAL '30 days' GROUP BY status"),
    get(db, "SELECT COUNT(*)::int AS count FROM password_reset_requests WHERE status = 'pending'"),
    get(db, "SELECT COUNT(*)::int AS count FROM booking_reminders WHERE sent_at >= NOW() - INTERVAL '7 days'"),
    get(db, `SELECT (SELECT COUNT(*) FROM salon_bookings WHERE created_at::date = CURRENT_DATE) + (SELECT COUNT(*) FROM artist_bookings WHERE source_salon_user_id IS NULL AND created_at::date = CURRENT_DATE) AS count`)
  ]);
  const bookingStatus = {};
  for (const row of [...salonStatus, ...artistStatus]) bookingStatus[row.status] = (bookingStatus[row.status] || 0) + row.count;
  const usersByType = Object.fromEntries(byType.map((row) => [row.type, row.count]));
  return {
    users: { total: byType.reduce((sum, row) => sum + row.count, 0), byType: usersByType, suspended: suspended?.count || 0 },
    signupsByDay: signups,
    bookingsLast30Days: bookingStatus,
    bookingsCreatedToday: Number(bookingsToday?.count || 0),
    pendingPasswordResets: resets?.count || 0,
    remindersSentLast7Days: reminders?.count || 0
  };
}

export async function listUsers({ q = "", type = "", limit = 25, offset = 0 } = {}) {
  const db = await getDb();
  const term = String(q || "").trim();
  const like = term ? `%${term.replace(/[%_\\]/g, "\\$&")}%` : "";
  const filters = [like ? "(name ILIKE $1 OR phone LIKE $1)" : "$1 = ''", "($2 = '' OR type = $2)"];
  const params = [like, ["client", "artist", "salon"].includes(type) ? type : ""];
  const where = filters.join(" AND ");
  const total = await get(db, `SELECT COUNT(*)::int AS count FROM users WHERE ${where}`, params);
  const rows = await all(db, `
    SELECT id, name, phone, type, area, created_at, last_seen_at, suspended_at
    FROM users WHERE ${where}
    ORDER BY id DESC LIMIT $3 OFFSET $4
  `, [...params, Math.min(Math.max(Number(limit) || 25, 1), 100), Math.max(Number(offset) || 0, 0)]);
  return { total: total?.count || 0, users: rows };
}

export async function setSuspended(userId, suspended) {
  const db = await getDb();
  const row = await get(db, `
    UPDATE users SET suspended_at = ${suspended ? "NOW()" : "NULL"} WHERE id = $1 RETURNING id, name, phone, suspended_at
  `, [Number(userId)]);
  if (row && suspended) await run(db, "DELETE FROM sessions WHERE user_id = $1", [Number(userId)]);
  return row || null;
}

export async function logAction({ adminUserId = null, adminLabel = "", action, targetUserId = null, detail = "" }) {
  const db = await getDb();
  await run(db, `
    INSERT INTO admin_actions (admin_user_id, admin_label, action, target_user_id, detail) VALUES ($1, $2, $3, $4, $5)
  `, [adminUserId, String(adminLabel).slice(0, 40), action, targetUserId, String(detail).slice(0, 300)]);
}

export async function listActions(limit = 50) {
  const db = await getDb();
  return all(db, `
    SELECT a.id, a.admin_label, a.action, a.target_user_id, a.detail, a.created_at, u.name AS target_name, u.phone AS target_phone
    FROM admin_actions a LEFT JOIN users u ON u.id = a.target_user_id
    ORDER BY a.id DESC LIMIT $1
  `, [Math.min(Math.max(Number(limit) || 50, 1), 200)]);
}
