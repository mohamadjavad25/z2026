import { getDb, all, get, run, withTransaction } from "../connection.js";
import { ensureSupportTables } from "./support.js";

/**
 * The operator's control room: settings changed without a deploy, broadcast messages, browser crash reports,
 * system health and the reports page. Tables are created on first use (same DDL as migrations/032_admin_control.sql).
 */
let ready;
export function ensureControlTables() {
  ready ??= (async () => {
    const db = await getDb();
    await run(db, `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT NOT NULL DEFAULT ''
    )`);
    await run(db, `CREATE TABLE IF NOT EXISTS admin_broadcasts (
      id SERIAL PRIMARY KEY,
      segment TEXT NOT NULL,
      channels TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '',
      recipients INTEGER NOT NULL DEFAULT 0,
      inboxed INTEGER NOT NULL DEFAULT 0,
      pushed INTEGER NOT NULL DEFAULT 0,
      admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      admin_label TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await run(db, "CREATE INDEX IF NOT EXISTS idx_admin_broadcasts_created ON admin_broadcasts (created_at DESC)");
    await run(db, `CREATE TABLE IF NOT EXISTS client_errors (
      id SERIAL PRIMARY KEY,
      message TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      stack TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await run(db, "CREATE INDEX IF NOT EXISTS idx_client_errors_created ON client_errors (created_at DESC)");
    await run(db, "CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions (target_user_id, id DESC)");
    await run(db, "CREATE INDEX IF NOT EXISTS idx_admin_actions_action ON admin_actions (action, id DESC)");
  })().catch((error) => {
    ready = undefined; // retry on the next request instead of caching a failure
    throw error;
  });
  return ready;
}

const clamp = (value, min, max, fallback) => Math.min(Math.max(Number(value) || fallback, min), max);

/* ───────────────────────── settings ───────────────────────── */

/** Every setting the panel can change, with the value used until the operator saves one. */
export const SETTING_DEFAULTS = {
  // The bar at the top of the app. `audience`: all | client | pro. `tone`: info | success | warning.
  notice: { enabled: false, text: "", tone: "info", audience: "all", link: "", linkLabel: "" },
  // New accounts. Closing one role (e.g. salons) keeps the others open.
  signups: { client: true, artist: true, salon: true, message: "" },
  // Saved answers the operator drops into a support reply with one click.
  replies: { items: [] },
  // Subscriptions for salons and artists (repos/billing.js). Changed only through /api/admin/billing/settings (password
  // re-check). `launchedAt` is stamped the first time billing is switched on and moves to today each time the panel switches it on again from off: accounts that existed
  // before it get their free month from that day.
  billing: { enabled: false, launchedAt: null, graceDays: 3 }
};

function merge(key, value) {
  const base = SETTING_DEFAULTS[key] || {};
  return value && typeof value === "object" && !Array.isArray(value) ? { ...base, ...value } : { ...base };
}

/** All settings, defaults filled in, plus when and by whom each was last changed. */
export async function getSettings() {
  await ensureControlTables();
  const db = await getDb();
  const rows = await all(db, "SELECT key, value, updated_at, updated_by FROM app_settings");
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
  return Object.fromEntries(Object.keys(SETTING_DEFAULTS).map((key) => [key, {
    ...merge(key, byKey[key]?.value),
    updatedAt: byKey[key]?.updated_at || null,
    updatedBy: byKey[key]?.updated_by || ""
  }]));
}

export async function getSetting(key) {
  if (!SETTING_DEFAULTS[key]) return null;
  await ensureControlTables();
  const db = await getDb();
  const row = await get(db, "SELECT value, updated_at, updated_by FROM app_settings WHERE key = $1", [key]);
  return { ...merge(key, row?.value), updatedAt: row?.updated_at || null, updatedBy: row?.updated_by || "" };
}

export async function saveSetting(key, value, label = "") {
  if (!SETTING_DEFAULTS[key]) throw new Error(`unknown setting ${key}`);
  await ensureControlTables();
  const db = await getDb();
  const row = await get(db, `
    INSERT INTO app_settings (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by
    RETURNING value, updated_at, updated_by
  `, [key, JSON.stringify(merge(key, value)), String(label).slice(0, 40)]);
  return { ...merge(key, row.value), updatedAt: row.updated_at, updatedBy: row.updated_by };
}

/** What the app shows to everyone: the notice, only while it is on. Its id changes with every save, so a closed notice comes back when it is edited. */
export async function getPublicNotice() {
  const notice = await getSetting("notice");
  if (!notice?.enabled || !notice.text) return null;
  return {
    id: notice.updatedAt ? new Date(notice.updatedAt).getTime() : 0,
    text: notice.text,
    tone: notice.tone,
    audience: notice.audience,
    link: notice.link,
    linkLabel: notice.linkLabel
  };
}

/* ───────────────────────── broadcasts ───────────────────────── */

/**
 * Who a broadcast can go to. Each is a WHERE clause over `users u`; suspended accounts never get one.
 * "incomplete" is a salon or artist with no services yet (they cannot be booked), the group the operator most often nudges.
 */
export const SEGMENTS = {
  all: "TRUE",
  client: "u.type = 'client'",
  artist: "u.type = 'artist'",
  salon: "u.type = 'salon'",
  pro: "u.type IN ('artist', 'salon')",
  new7: "u.created_at >= NOW() - INTERVAL '7 days'",
  inactive30: "(u.last_seen_at IS NULL OR u.last_seen_at < NOW() - INTERVAL '30 days')",
  incomplete: `u.type IN ('artist', 'salon') AND NOT EXISTS (SELECT 1 FROM salon_services s WHERE s.salon_user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM artist_services a WHERE a.user_id = u.id)`
};
const segmentWhere = (segment) => `u.suspended_at IS NULL AND (${SEGMENTS[segment] || "FALSE"})`;

/** How many people a segment reaches, and how many of them can get a push notification. */
export async function countSegment(segment) {
  if (!SEGMENTS[segment]) return { recipients: 0, withPush: 0 };
  const db = await getDb();
  const row = await get(db, `
    SELECT COUNT(*)::int AS recipients,
           COUNT(*) FILTER (WHERE (EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = u.id) OR EXISTS (SELECT 1 FROM native_push_tokens n WHERE n.user_id = u.id)))::int AS with_push
    FROM users u WHERE ${segmentWhere(segment)}
  `);
  return { recipients: row?.recipients || 0, withPush: row?.with_push || 0 };
}

/**
 * Puts the message in every recipient's support center, in one statement. The ticket is created closed (resolution
 * "broadcast") so a thousand copies never crowd the admin's inbox; a user who answers reopens theirs like any other.
 * Returns the number of inboxes written.
 */
export async function inboxSegment(segment, { title, body, adminUserId = null }) {
  if (!SEGMENTS[segment]) return 0;
  await ensureSupportTables();
  const db = await getDb();
  const result = await run(db, `
    WITH t AS (
      INSERT INTO support_tickets (kind, user_id, contact_phone, category, subject, body, status, last_actor, from_admin, resolution, closed_at)
      SELECT 'support', u.id, u.phone, 'other', $1, '', 'closed', 'admin', TRUE, 'broadcast', NOW() FROM users u WHERE ${segmentWhere(segment)}
      RETURNING id
    )
    INSERT INTO support_messages (ticket_id, author, author_user_id, body) SELECT id, 'admin', $2, $3 FROM t
  `, [String(title || "").slice(0, 120), adminUserId, String(body).slice(0, 2000)]);
  return result.rowCount || 0;
}

/** Ids of the people in a segment who have at least one push subscription (browser or Android app). */
export async function pushableUserIds(segment) {
  if (!SEGMENTS[segment]) return [];
  const db = await getDb();
  const rows = await all(db, `
    SELECT u.id FROM users u WHERE ${segmentWhere(segment)} AND (EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = u.id) OR EXISTS (SELECT 1 FROM native_push_tokens n WHERE n.user_id = u.id))
  `);
  return rows.map((row) => row.id);
}

/**
 * Records a broadcast BEFORE it is sent, so a second click (or a retry while the first is still sending) finds it and
 * is refused instead of sending everything twice. Under a lock on (segment, text), so two requests at the same moment
 * cannot both pass the check. Returns null when the same text went to the same group in the last few minutes.
 */
export async function claimBroadcast({ segment, channels, title, body, url, recipients, adminUserId, adminLabel }, windowMinutes = 5) {
  await ensureControlTables();
  return withTransaction(null, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`broadcast:${segment}:${body}`]);
    const recent = await client.query(`
      SELECT 1 FROM admin_broadcasts WHERE segment = $1 AND body = $2 AND created_at > now() - make_interval(mins => $3) LIMIT 1
    `, [segment, String(body).slice(0, 2000), windowMinutes]);
    if (recent.rowCount) return null;
    const inserted = await client.query(`
      INSERT INTO admin_broadcasts (segment, channels, title, body, url, recipients, inboxed, pushed, admin_user_id, admin_label)
      VALUES ($1, $2, $3, $4, $5, $6, 0, 0, $7, $8) RETURNING *
    `, [segment, channels.join(","), String(title || "").slice(0, 120), String(body).slice(0, 2000), String(url || "").slice(0, 300), recipients, adminUserId, String(adminLabel || "").slice(0, 40)]);
    return inserted.rows[0];
  });
}

/** Writes how many inboxes and devices a claimed broadcast reached, once it is sent. */
export async function finishBroadcast(id, { inboxed, pushed }) {
  const db = await getDb();
  return get(db, "UPDATE admin_broadcasts SET inboxed = $2, pushed = $3 WHERE id = $1 RETURNING *", [id, inboxed, pushed]);
}

export async function listBroadcasts(limit = 30) {
  await ensureControlTables();
  const db = await getDb();
  return all(db, "SELECT * FROM admin_broadcasts ORDER BY id DESC LIMIT $1", [clamp(limit, 1, 100, 30)]);
}

/* ───────────────────────── crash reports ───────────────────────── */

const KEEP_ERRORS = 2000;

/** Keeps a browser crash for the health page. Only the newest few thousand are kept. Never throws. */
export async function recordClientError({ message, source = "", url = "", userAgent = "", stack = "" }) {
  try {
    await ensureControlTables();
    const db = await getDb();
    const row = await get(db, `
      INSERT INTO client_errors (message, source, url, user_agent, stack) VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [String(message).slice(0, 500), String(source).slice(0, 60), String(url).slice(0, 300), String(userAgent).slice(0, 300), String(stack).slice(0, 4000)]);
    if (row && row.id % 100 === 0) await run(db, "DELETE FROM client_errors WHERE id <= $1", [row.id - KEEP_ERRORS]);
  } catch {
    // the log line in /api/client-errors is the fallback
  }
}

/** Crashes of the last `days` days grouped by message (most frequent first), plus the newest ones as they came. */
export async function listClientErrors({ days = 7, limit = 30 } = {}) {
  await ensureControlTables();
  const db = await getDb();
  const window = clamp(days, 1, 90, 7);
  const [groups, recent, totals] = await Promise.all([
    all(db, `
      SELECT message, source, COUNT(*)::int AS count, MAX(created_at) AS last_at, MIN(created_at) AS first_at,
             (ARRAY_AGG(url ORDER BY id DESC))[1] AS url, (ARRAY_AGG(stack ORDER BY id DESC))[1] AS stack,
             (ARRAY_AGG(user_agent ORDER BY id DESC))[1] AS user_agent
      FROM client_errors WHERE created_at >= NOW() - $1::int * INTERVAL '1 day'
      GROUP BY message, source ORDER BY count DESC, last_at DESC LIMIT $2
    `, [window, clamp(limit, 1, 100, 30)]),
    all(db, "SELECT id, message, source, url, user_agent, created_at FROM client_errors ORDER BY id DESC LIMIT 15"),
    get(db, `
      SELECT COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS day,
             COUNT(*) FILTER (WHERE created_at >= NOW() - $1::int * INTERVAL '1 day')::int AS window
      FROM client_errors
    `, [window])
  ]);
  return { groups, recent, last24h: totals?.day || 0, inWindow: totals?.window || 0, days: window };
}

export async function clearClientErrors() {
  await ensureControlTables();
  const db = await getDb();
  const result = await run(db, "DELETE FROM client_errors");
  return result.rowCount || 0;
}

/* ───────────────────────── system health ───────────────────────── */

const WATCHED_TABLES = ["users", "posts", "salon_bookings", "artist_bookings", "support_tickets", "support_messages", "sessions", "push_subscriptions", "sms_log", "rate_limit_hits", "admin_actions", "client_errors"];

/** Database, jobs and delivery numbers for the health page. No user content is read. */
export async function getSystemHealth() {
  await ensureControlTables();
  const db = await getDb();
  const started = process.hrtime.bigint();
  await get(db, "SELECT 1 AS ok");
  const latencyMs = Number(process.hrtime.bigint() - started) / 1e6;
  const [meta, tables, jobs, push, sessions] = await Promise.all([
    get(db, "SELECT current_setting('server_version') AS version, pg_database_size(current_database())::bigint AS size"),
    all(db, `
      SELECT c.relname AS name, GREATEST(c.reltuples, 0)::bigint AS estimate, pg_total_relation_size(c.oid)::bigint AS bytes
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema() AND c.relkind = 'r' AND c.relname = ANY($1) ORDER BY bytes DESC
    `, [WATCHED_TABLES]),
    get(db, `
      SELECT
        (SELECT MAX(sent_at) FROM booking_reminders) AS last_reminder,
        (SELECT COUNT(*)::int FROM booking_reminders WHERE sent_at >= NOW() - INTERVAL '24 hours') AS reminders_24h,
        (SELECT COUNT(*)::int FROM salon_bookings WHERE status = 'منقضی شده') + (SELECT COUNT(*)::int FROM artist_bookings WHERE status = 'منقضی شده') AS expired_total,
        (SELECT COUNT(*)::int FROM rate_limit_hits) AS rate_limit_rows
    `).catch(() => ({})),
    get(db, "SELECT COUNT(*)::int AS subscriptions, COUNT(DISTINCT user_id)::int AS users FROM push_subscriptions"),
    get(db, `
      SELECT COUNT(*) FILTER (WHERE expires_at > NOW())::int AS live, COUNT(*) FILTER (WHERE expires_at <= NOW())::int AS expired,
             (SELECT COUNT(*)::int FROM users WHERE last_seen_at >= NOW() - INTERVAL '5 minutes') AS online
      FROM sessions
    `)
  ]);
  // reltuples is an estimate (-1 / 0 until the table is first analyzed): count small tables exactly.
  for (const table of tables) {
    if (Number(table.estimate) < 5000) table.estimate = (await get(db, `SELECT COUNT(*)::bigint AS count FROM "${table.name}"`))?.count ?? table.estimate;
  }
  return {
    db: { latencyMs: Math.round(latencyMs * 10) / 10, version: meta?.version || "", sizeBytes: Number(meta?.size || 0) },
    tables: tables.map((table) => ({ name: table.name, rows: Number(table.estimate), bytes: Number(table.bytes) })),
    jobs: {
      lastReminderAt: jobs?.last_reminder || null,
      reminders24h: jobs?.reminders_24h || 0,
      expiredBookings: jobs?.expired_total || 0,
      rateLimitRows: jobs?.rate_limit_rows || 0
    },
    push: { subscriptions: push?.subscriptions || 0, users: push?.users || 0 },
    sessions: { live: sessions?.live || 0, expired: sessions?.expired || 0, online: sessions?.online || 0 }
  };
}

/** Housekeeping the operator can run from the health page: expired sessions and old rate-limit rows. Returns what was removed. */
export async function runCleanup() {
  const db = await getDb();
  const [sessions, limits] = await Promise.all([
    run(db, "DELETE FROM sessions WHERE expires_at <= NOW()"),
    run(db, "DELETE FROM rate_limit_hits WHERE hit_at < NOW() - INTERVAL '1 day'").catch(() => ({ rowCount: 0 }))
  ]);
  return { sessions: sessions.rowCount || 0, rateLimits: limits.rowCount || 0 };
}

/* ───────────────────────── reports ───────────────────────── */

const TZ = "Asia/Tehran";
// Salon bookings plus the artists' own (an artist row mirrored from a salon booking is the same visit, so it is skipped).
const BOOKINGS = `
  SELECT 'salon' AS kind, b.id, b.salon_user_id AS provider_id, b.client_user_id, b.service, b.status, b.created_at FROM salon_bookings b
  UNION ALL
  SELECT 'artist', b.id, b.artist_user_id, b.client_user_id, b.service, b.status, b.created_at FROM artist_bookings b WHERE b.source_salon_user_id IS NULL
`;

/** Everything the reports page shows for the last `days` days. */
export async function getReports(rangeDays = 30) {
  const days = [7, 30, 90].includes(Number(rangeDays)) ? Number(rangeDays) : 30;
  const db = await getDb();
  const since = `NOW() - ${days} * INTERVAL '1 day'`;
  const [providers, services, statuses, heat, funnel, areas, readiness, activity] = await Promise.all([
    all(db, `
      SELECT x.provider_id AS id, u.name, u.type, u.area, COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE x.status = 'تایید شده')::int AS confirmed,
             COUNT(*) FILTER (WHERE x.status = 'لغو')::int AS cancelled,
             COUNT(*) FILTER (WHERE x.status = 'منقضی شده')::int AS expired
      FROM (${BOOKINGS}) x JOIN users u ON u.id = x.provider_id
      WHERE x.created_at >= ${since} GROUP BY x.provider_id, u.name, u.type, u.area ORDER BY total DESC LIMIT 10
    `),
    all(db, `
      SELECT COALESCE(NULLIF(TRIM(service), ''), 'بدون نام') AS service, COUNT(*)::int AS count
      FROM (${BOOKINGS}) x WHERE x.created_at >= ${since} GROUP BY 1 ORDER BY count DESC LIMIT 10
    `),
    all(db, `SELECT status, COUNT(*)::int AS count FROM (${BOOKINGS}) x WHERE x.created_at >= ${since} GROUP BY status ORDER BY count DESC`),
    all(db, `
      SELECT EXTRACT(ISODOW FROM created_at AT TIME ZONE '${TZ}')::int AS dow, EXTRACT(HOUR FROM created_at AT TIME ZONE '${TZ}')::int AS hour, COUNT(*)::int AS count
      FROM (${BOOKINGS}) x WHERE x.created_at >= ${since} GROUP BY 1, 2
    `),
    get(db, `
      SELECT COUNT(*)::int AS clients,
             COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM (${BOOKINGS}) x WHERE x.client_user_id = u.id))::int AS booked,
             COUNT(*) FILTER (WHERE u.last_seen_at >= NOW() - INTERVAL '7 days')::int AS returning
      FROM users u WHERE u.type = 'client' AND u.created_at >= ${since}
    `),
    all(db, `
      SELECT COALESCE(NULLIF(TRIM(area), ''), 'نامشخص') AS area,
             COUNT(*) FILTER (WHERE type = 'client')::int AS clients,
             COUNT(*) FILTER (WHERE type IN ('artist', 'salon'))::int AS pros
      FROM users GROUP BY 1 ORDER BY (COUNT(*)) DESC LIMIT 12
    `),
    all(db, `
      SELECT u.id, u.name, u.type, u.phone, u.created_at, u.last_seen_at,
             (u.avatar <> '' OR COALESCE(u.avatar_url, '') <> '') AS has_avatar,
             ((SELECT COUNT(*) FROM salon_services s WHERE s.salon_user_id = u.id) + (SELECT COUNT(*) FROM artist_services a WHERE a.user_id = u.id))::int AS services,
             (SELECT COUNT(*)::int FROM posts p WHERE p.owner_user_id = u.id) AS posts
      FROM users u WHERE u.type IN ('artist', 'salon') AND u.suspended_at IS NULL
      ORDER BY u.id DESC LIMIT 400
    `),
    get(db, `
      SELECT COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '1 day')::int AS dau,
             COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '7 days')::int AS wau,
             COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '30 days')::int AS mau,
             COUNT(*)::int AS total
      FROM users
    `)
  ]);
  const missing = readiness
    .map((row) => ({ ...row, gaps: [row.services ? null : "services", row.has_avatar ? null : "avatar", row.posts ? null : "posts"].filter(Boolean) }))
    .filter((row) => row.gaps.length);
  const pros = readiness.length;
  return {
    days,
    providers,
    services,
    statuses,
    heat,
    funnel: { clients: funnel?.clients || 0, booked: funnel?.booked || 0, returning: funnel?.returning || 0 },
    areas,
    readiness: {
      pros,
      ready: pros - missing.length,
      noServices: missing.filter((row) => row.gaps.includes("services")).length,
      noAvatar: missing.filter((row) => row.gaps.includes("avatar")).length,
      noPosts: missing.filter((row) => row.gaps.includes("posts")).length,
      list: missing.slice(0, 40)
    },
    activity: activity || { dau: 0, wau: 0, mau: 0, total: 0 }
  };
}
