import { getDb, all, get } from "../connection.js";

const TZ = "Asia/Tehran";
const DAY = "INTERVAL '1 day'";

/**
 * Expected total for the next `ahead` days: the average day so far, scaled by how the recent half compares with the earlier half
 * (the scale is capped to 0.5x..1.5x so one spike or one quiet day cannot make the estimate swing wildly). Never negative.
 */
export function forecastNext(values, ahead = 7) {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const half = Math.floor(n / 2);
  const avg = (slice) => slice.reduce((sum, value) => sum + value, 0) / slice.length;
  const trend = n >= 4 ? (avg(values.slice(n - half)) + 0.5) / (avg(values.slice(0, half)) + 0.5) : 1;
  return Math.max(0, Math.round(mean * ahead * Math.min(1.5, Math.max(0.5, trend))));
}

const pctChange = (current, previous) => {
  if (!previous) return current ? null : 0; // null = "new" (no previous data to compare with)
  return Math.round(((current - previous) / previous) * 100);
};

/** Everything the admin home page shows, in one call. `rangeDays` is 7 or 30. */
export async function getDashboard(rangeDays = 7) {
  const days = Number(rangeDays) === 30 ? 30 : 7;
  const db = await getDb();

  const [series, windows, totals, byType, statuses, alerts, feed] = await Promise.all([
    all(db, `
      WITH d AS (
        SELECT g::date AS day FROM generate_series((NOW() AT TIME ZONE '${TZ}')::date - ($1::int - 1), (NOW() AT TIME ZONE '${TZ}')::date, ${DAY}) g
      ),
      u AS (SELECT (created_at AT TIME ZONE '${TZ}')::date AS day, COUNT(*)::int AS c FROM users WHERE created_at >= NOW() - ($1::int + 1) * ${DAY} GROUP BY 1),
      b AS (
        SELECT day, COUNT(*)::int AS c FROM (
          SELECT (created_at AT TIME ZONE '${TZ}')::date AS day FROM salon_bookings WHERE created_at >= NOW() - ($1::int + 1) * ${DAY}
          UNION ALL
          SELECT (created_at AT TIME ZONE '${TZ}')::date FROM artist_bookings WHERE source_salon_user_id IS NULL AND created_at >= NOW() - ($1::int + 1) * ${DAY}
        ) x GROUP BY day
      ),
      p AS (SELECT (created_at AT TIME ZONE '${TZ}')::date AS day, COUNT(*)::int AS c FROM posts WHERE created_at >= NOW() - ($1::int + 1) * ${DAY} GROUP BY 1)
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COALESCE(u.c, 0) AS signups, COALESCE(b.c, 0) AS bookings, COALESCE(p.c, 0) AS posts
      FROM d LEFT JOIN u ON u.day = d.day LEFT JOIN b ON b.day = d.day LEFT JOIN p ON p.day = d.day ORDER BY d.day
    `, [days]),
    get(db, `
      SELECT
        (SELECT COUNT(*)::int FROM users WHERE created_at >= NOW() - $1::int * ${DAY}) AS signups_cur,
        (SELECT COUNT(*)::int FROM users WHERE created_at >= NOW() - 2 * $1::int * ${DAY} AND created_at < NOW() - $1::int * ${DAY}) AS signups_prev,
        (SELECT COUNT(*)::int FROM salon_bookings WHERE created_at >= NOW() - $1::int * ${DAY})
          + (SELECT COUNT(*)::int FROM artist_bookings WHERE source_salon_user_id IS NULL AND created_at >= NOW() - $1::int * ${DAY}) AS bookings_cur,
        (SELECT COUNT(*)::int FROM salon_bookings WHERE created_at >= NOW() - 2 * $1::int * ${DAY} AND created_at < NOW() - $1::int * ${DAY})
          + (SELECT COUNT(*)::int FROM artist_bookings WHERE source_salon_user_id IS NULL AND created_at >= NOW() - 2 * $1::int * ${DAY} AND created_at < NOW() - $1::int * ${DAY}) AS bookings_prev,
        (SELECT COUNT(*)::int FROM posts WHERE created_at >= NOW() - $1::int * ${DAY}) AS posts_cur,
        (SELECT COUNT(*)::int FROM posts WHERE created_at >= NOW() - 2 * $1::int * ${DAY} AND created_at < NOW() - $1::int * ${DAY}) AS posts_prev,
        (SELECT COUNT(*)::int FROM users WHERE last_seen_at >= NOW() - $1::int * ${DAY}) AS active_cur
    `, [days]),
    get(db, `
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM users WHERE suspended_at IS NOT NULL) AS suspended,
        (SELECT COUNT(*)::int FROM posts) AS posts,
        (SELECT COUNT(*)::int FROM posts WHERE NOT is_public) AS hidden_posts,
        (SELECT COUNT(*)::int FROM salon_bookings) + (SELECT COUNT(*)::int FROM artist_bookings WHERE source_salon_user_id IS NULL) AS bookings
    `),
    all(db, "SELECT type, COUNT(*)::int AS count FROM users GROUP BY type ORDER BY count DESC"),
    all(db, `
      SELECT status, COUNT(*)::int AS count FROM (
        SELECT status FROM salon_bookings WHERE created_at >= NOW() - 30 * ${DAY}
        UNION ALL SELECT status FROM artist_bookings WHERE source_salon_user_id IS NULL AND created_at >= NOW() - 30 * ${DAY}
      ) x GROUP BY status ORDER BY count DESC
    `),
    get(db, `
      SELECT
        (SELECT COUNT(*)::int FROM password_reset_requests WHERE status = 'pending') AS pending_resets,
        (SELECT COUNT(*)::int FROM sms_log WHERE status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours') AS sms_failed,
        (SELECT COUNT(*)::int FROM admin_actions WHERE action IN ('login_failed', 'login_blocked', 'enroll_failed', 'stepup_failed') AND created_at >= NOW() - INTERVAL '24 hours') AS admin_failed_logins
    `),
    all(db, `
      SELECT kind, title, detail, at FROM (
        (SELECT 'signup' AS kind, COALESCE(NULLIF(name, ''), phone) AS title, type AS detail, created_at AS at FROM users ORDER BY created_at DESC LIMIT 12)
        UNION ALL
        (SELECT 'booking', COALESCE(NULLIF(service, ''), 'رزرو'), COALESCE(NULLIF(client, ''), phone) || ' • ' || status, created_at FROM salon_bookings ORDER BY created_at DESC LIMIT 12)
        UNION ALL
        (SELECT 'booking', COALESCE(NULLIF(service, ''), 'رزرو'), COALESCE(NULLIF(client_name, ''), client_phone) || ' • ' || status, created_at FROM artist_bookings WHERE source_salon_user_id IS NULL ORDER BY created_at DESC LIMIT 12)
        UNION ALL
        (SELECT 'post', title, tag, created_at FROM posts ORDER BY created_at DESC LIMIT 12)
        UNION ALL
        (SELECT 'admin', action, COALESCE(NULLIF(admin_label, ''), '') || ' ' || detail, created_at FROM admin_actions ORDER BY id DESC LIMIT 12)
      ) x ORDER BY at DESC LIMIT 20
    `)
  ]);

  const signups = series.map((row) => row.signups);
  const bookings = series.map((row) => row.bookings);
  return {
    days,
    kpis: {
      signups: { value: windows.signups_cur, change: pctChange(windows.signups_cur, windows.signups_prev) },
      bookings: { value: windows.bookings_cur, change: pctChange(windows.bookings_cur, windows.bookings_prev) },
      posts: { value: windows.posts_cur, change: pctChange(windows.posts_cur, windows.posts_prev) },
      active: { value: windows.active_cur }
    },
    totals,
    byType,
    statuses,
    series,
    alerts: {
      pendingResets: alerts?.pending_resets || 0,
      smsFailed: alerts?.sms_failed || 0,
      adminFailedLogins: alerts?.admin_failed_logins || 0,
      suspended: totals?.suspended || 0,
      hiddenPosts: totals?.hidden_posts || 0
    },
    forecast: {
      signups: forecastNext(signups, 7),
      bookings: forecastNext(bookings, 7),
      basedOnDays: days,
      reliable: signups.reduce((a, b) => a + b, 0) + bookings.reduce((a, b) => a + b, 0) >= 10
    },
    feed
  };
}
