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

const USER_STATUS = {
  active: "u.suspended_at IS NULL",
  suspended: "u.suspended_at IS NOT NULL",
  new: "u.created_at >= NOW() - INTERVAL '7 days'",
  online: "u.last_seen_at >= NOW() - INTERVAL '15 minutes'",
  inactive: "(u.last_seen_at IS NULL OR u.last_seen_at < NOW() - INTERVAL '30 days')"
};
const USER_SORT = {
  new: "u.id DESC",
  old: "u.id ASC",
  seen: "u.last_seen_at DESC NULLS LAST, u.id DESC",
  name: "NULLIF(u.name, '') ASC NULLS LAST, u.id DESC",
  cancels: "u.provider_cancel_count DESC, u.id DESC"
};

/**
 * The accounts list. `status` narrows it (active, suspended, new this week, online now, away for 30 days),
 * `sort` orders it; `counts` feeds the filter chips (for the current search and type, before the status filter).
 */
export async function listUsers({ q = "", type = "", status = "", sort = "new", limit = 25, offset = 0 } = {}) {
  const db = await getDb();
  const term = String(q || "").trim();
  const like = term ? `%${term.replace(/[%_\\]/g, "\\$&")}%` : "";
  const base = "($1 = '' OR u.name ILIKE $1 OR u.phone LIKE $1 OR u.email ILIKE $1 OR u.area ILIKE $1) AND ($2 = '' OR u.type = $2)";
  const params = [like, ["client", "artist", "salon"].includes(type) ? type : ""];
  const where = USER_STATUS[status] ? `${base} AND ${USER_STATUS[status]}` : base;
  const [total, rows, counts] = await Promise.all([
    get(db, `SELECT COUNT(*)::int AS count FROM users u WHERE ${where}`, params),
    all(db, `
      SELECT u.id, u.name, u.phone, u.type, u.area, u.created_at, u.last_seen_at, u.suspended_at, u.provider_cancel_count,
             (u.avatar <> '' OR COALESCE(u.avatar_url, '') <> '') AS has_avatar
      FROM users u WHERE ${where}
      ORDER BY ${USER_SORT[sort] || USER_SORT.new} LIMIT $3 OFFSET $4
    `, [...params, Math.min(Math.max(Number(limit) || 25, 1), 200), Math.max(Number(offset) || 0, 0)]),
    get(db, `
      SELECT COUNT(*)::int AS all, ${Object.entries(USER_STATUS).map(([key, sql]) => `COUNT(*) FILTER (WHERE ${sql})::int AS ${key}`).join(", ")}
      FROM users u WHERE ${base}
    `, params)
  ]);
  return { total: total?.count || 0, users: rows, counts: counts || {} };
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

/** Action groups the audit log can be narrowed to (each is a list of `admin_actions.action` values). */
export const ACTION_GROUPS = {
  accounts: ["suspend", "unsuspend", "force_logout", "delete_user", "edit_user", "set_password", "resolve_password_reset", "bulk_users"],
  content: ["post_hide", "post_show", "post_delete", "bulk_posts"],
  bookings: ["booking_cancel"],
  billing: ["billing_settings", "billing_test_accounts", "billing_grant", "billing_reverify", "billing_refund"],
  support: ["support_update", "broadcast"],
  system: ["settings_update", "export", "cleanup", "clear_errors"],
  security: ["login", "login_failed", "login_blocked", "enroll", "enroll_failed", "stepup", "stepup_failed", "revoke_sessions", "reset_authenticator"]
};

/** The audit log, newest first: filter by group, by admin, by the account it touched, or by text. */
export async function listActions({ group = "", admin = "", q = "", targetUserId = null, limit = 50, offset = 0 } = {}) {
  const db = await getDb();
  const actions = ACTION_GROUPS[group] || [];
  const term = String(q || "").trim();
  const like = term ? `%${term.replace(/[%_\\]/g, "\\$&")}%` : "";
  const where = `(cardinality($1::text[]) = 0 OR a.action = ANY($1)) AND ($2 = '' OR a.admin_label = $2)
    AND ($3 = '' OR a.detail ILIKE $3 OR u.name ILIKE $3 OR u.phone LIKE $3) AND ($4::int IS NULL OR a.target_user_id = $4)`;
  const params = [actions, String(admin || "").slice(0, 40), like, targetUserId ? Number(targetUserId) : null];
  const [total, rows, admins] = await Promise.all([
    get(db, `SELECT COUNT(*)::int AS count FROM admin_actions a LEFT JOIN users u ON u.id = a.target_user_id WHERE ${where}`, params),
    all(db, `
      SELECT a.id, a.admin_label, a.action, a.target_user_id, a.detail, a.created_at, u.name AS target_name, u.phone AS target_phone
      FROM admin_actions a LEFT JOIN users u ON u.id = a.target_user_id
      WHERE ${where} ORDER BY a.id DESC LIMIT $5 OFFSET $6
    `, [...params, Math.min(Math.max(Number(limit) || 50, 1), 500), Math.max(Number(offset) || 0, 0)]),
    all(db, "SELECT admin_label AS label, COUNT(*)::int AS count FROM admin_actions WHERE admin_label <> '' GROUP BY admin_label ORDER BY count DESC LIMIT 20")
  ]);
  return { total: total?.count || 0, actions: rows, admins };
}

/** SMS health for the overview card: is a provider set, and how did the last 24 hours go. */
export async function getSmsStatus(provider) {
  const db = await getDb();
  const [counts, lastFailure] = await Promise.all([
    all(db, "SELECT status, COUNT(*)::int AS count FROM sms_log WHERE created_at >= NOW() - INTERVAL '24 hours' GROUP BY status"),
    get(db, "SELECT detail, created_at FROM sms_log WHERE status = 'failed' ORDER BY id DESC LIMIT 1")
  ]);
  const byStatus = Object.fromEntries(counts.map((row) => [row.status, row.count]));
  return { provider: provider || "", sent24h: byStatus.sent || 0, failed24h: byStatus.failed || 0, lastFailure: lastFailure || null };
}

/** Test-provider only: the most recent code "sent" to a phone, so automated tests can finish the sign-up flow. */
export async function latestTestSms(phone) {
  const db = await getDb();
  return get(db, "SELECT body, created_at FROM sms_log WHERE provider = 'test' AND phone = $1 ORDER BY id DESC LIMIT 1", [String(phone)]);
}
