import { getDb, all, get, run } from "../connection.js";
import { ensureSupportTables } from "./support.js";
import { deleteStoredImage } from "../../storage.js";
import { formatPersianDateKey } from "../../../shared/lib/persianCalendar.js";
import { cancelSalonBooking } from "./salons/bookings.js";

const clamp = (value, min, max, fallback) => Math.min(Math.max(Number(value) || fallback, min), max);
const likeOf = (term) => {
  const text = String(term || "").trim();
  return text ? `%${text.replace(/[%_\\]/g, "\\$&")}%` : "";
};

/** One account for the admin detail view: profile fields (never the password hash or image bytes) plus counts and recent bookings. */
export async function getUserDetail(id) {
  const db = await getDb();
  const user = await get(db, `
    SELECT id, name, phone, email, type, area, service, manager_name, experience_years, created_at, updated_at, last_seen_at, suspended_at,
           (avatar <> '' OR COALESCE(avatar_url, '') <> '') AS has_avatar
    FROM users WHERE id = $1
  `, [Number(id)]);
  if (!user) return null;
  await Promise.all([ensureSupportTables(), ensureUserNotes()]);
  const [counts, sessions, bookings, posts, tickets, note, history, setup, devices] = await Promise.all([
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
    `, [user.id]),
    all(db, "SELECT id, title, is_public, created_at FROM posts WHERE owner_user_id = $1 ORDER BY id DESC LIMIT 8", [user.id]),
    all(db, "SELECT id, kind, subject, status, last_actor, last_message_at FROM support_tickets WHERE user_id = $1 ORDER BY last_message_at DESC LIMIT 6", [user.id]),
    get(db, "SELECT note, updated_at, updated_by FROM admin_user_notes WHERE user_id = $1", [user.id]),
    all(db, "SELECT id, admin_label, action, detail, created_at FROM admin_actions WHERE target_user_id = $1 ORDER BY id DESC LIMIT 20", [user.id]),
    // What a salon or artist has set up: without services nobody can book them.
    user.type === "client" ? null : get(db, `
      SELECT
        ((SELECT COUNT(*) FROM salon_services WHERE salon_user_id = $1) + (SELECT COUNT(*) FROM artist_services WHERE user_id = $1))::int AS services,
        (SELECT COUNT(*)::int FROM salon_staff WHERE salon_user_id = $1) AS staff,
        ((SELECT COUNT(*) FROM salon_hours WHERE salon_user_id = $1 AND active) + (SELECT COUNT(*) FROM artist_hours WHERE artist_user_id = $1 AND active))::int AS open_days
    `, [user.id]).catch(() => null),
    get(db, "SELECT ((SELECT COUNT(*) FROM push_subscriptions WHERE user_id = $1) + (SELECT COUNT(*) FROM native_push_tokens WHERE user_id = $1))::int AS count", [user.id]).catch(() => ({ count: 0 }))
  ]);
  return {
    user,
    counts: counts || {},
    activeSessions: sessions?.count || 0,
    pushDevices: devices?.count || 0,
    recentBookings: bookings,
    posts,
    tickets,
    history,
    setup: setup || null,
    note: note || { note: "", updated_at: null, updated_by: "" }
  };
}

let notesReady;
/** Private admin notes about an account (never shown to the user). Created on first use, like the other admin tables. */
function ensureUserNotes() {
  notesReady ??= (async () => {
    const db = await getDb();
    await run(db, `CREATE TABLE IF NOT EXISTS admin_user_notes (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      note TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT NOT NULL DEFAULT ''
    )`);
  })().catch((error) => {
    notesReady = undefined;
    throw error;
  });
  return notesReady;
}

export async function saveUserNote(userId, note, label = "") {
  await ensureUserNotes();
  const db = await getDb();
  await run(db, `
    INSERT INTO admin_user_notes (user_id, note, updated_by) VALUES ($1, $2, $3)
    ON CONFLICT (user_id) DO UPDATE SET note = EXCLUDED.note, updated_at = NOW(), updated_by = EXCLUDED.updated_by
  `, [Number(userId), String(note || "").slice(0, 2000), String(label).slice(0, 40)]);
}

export async function deleteUser(id) {
  const db = await getDb();
  const row = await get(db, "DELETE FROM users WHERE id = $1 RETURNING id, phone, name", [Number(id)]);
  return row || null;
}

export async function listPosts({ q = "", visibility = "", limit = 25, offset = 0 } = {}) {
  await ensureSupportTables();
  const db = await getDb();
  const like = likeOf(q);
  const vis = ["public", "hidden", "reported"].includes(visibility) ? visibility : "";
  const where = `($1 = '' OR p.title ILIKE $1 OR p.caption ILIKE $1 OR u.name ILIKE $1 OR u.phone LIKE $1)
    AND ($2 = '' OR ($2 = 'public' AND p.is_public) OR ($2 = 'hidden' AND NOT p.is_public)
      OR ($2 = 'reported' AND EXISTS (SELECT 1 FROM support_tickets t WHERE t.kind = 'report' AND t.target_type = 'post' AND t.target_id = p.id AND t.status <> 'closed')))`;
  const total = await get(db, `SELECT COUNT(*)::int AS count FROM posts p JOIN users u ON u.id = p.owner_user_id WHERE ${where}`, [like, vis]);
  const rows = await all(db, `
    SELECT p.id, p.title, p.tag, p.caption, p.is_public, p.views_count, p.saves_count, p.created_at, p.updated_at,
           u.id AS owner_id, u.name AS owner_name, u.phone AS owner_phone, u.type AS owner_type,
           (COALESCE(p.image_url, '') <> '' OR p.image <> '') AS has_image,
           (SELECT COUNT(*)::int FROM support_tickets t WHERE t.kind = 'report' AND t.target_type = 'post' AND t.target_id = p.id) AS reports
    FROM posts p JOIN users u ON u.id = p.owner_user_id
    WHERE ${where} ORDER BY p.id DESC LIMIT $3 OFFSET $4
  `, [like, vis, clamp(limit, 1, 100, 25), Math.max(Number(offset) || 0, 0)]);
  return { total: total?.count || 0, posts: rows };
}

export async function setPostPublic(id, isPublic) {
  const db = await getDb();
  return (await get(db, "UPDATE posts SET is_public = $2, updated_at = NOW() WHERE id = $1 RETURNING id, title, owner_user_id, is_public", [Number(id), Boolean(isPublic)])) || null;
}

/** Removes a post and its pictures in Storage (a row-only delete used to leave the files behind). */
export async function deletePost(id) {
  const db = await getDb();
  const row = await get(db, "DELETE FROM posts WHERE id = $1 RETURNING id, title, owner_user_id, image_url, thumb_url", [Number(id)]);
  if (!row) return null;
  await Promise.all([deleteStoredImage(row.image_url), deleteStoredImage(row.thumb_url)]).catch(() => {});
  return { id: row.id, title: row.title, owner_user_id: row.owner_user_id };
}

/** Several posts at once: hide, show or delete. Returns the posts that were changed. */
export async function bulkPosts(ids, action) {
  const list = [...new Set(ids.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 200);
  if (!list.length) return [];
  if (action === "delete") {
    const done = [];
    for (const id of list) {
      const row = await deletePost(id);
      if (row) done.push(row);
    }
    return done;
  }
  const db = await getDb();
  return all(db, "UPDATE posts SET is_public = $2, updated_at = NOW() WHERE id = ANY($1) AND is_public <> $2 RETURNING id, title, owner_user_id", [list, action === "show"]);
}

/** Several accounts at once (never an admin: the caller passes their ids in `protectedIds`). */
export async function bulkUsers(ids, action, protectedIds = []) {
  const keep = new Set(protectedIds.map(Number));
  const list = [...new Set(ids.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0 && !keep.has(id)))].slice(0, 200);
  if (!list.length) return [];
  const db = await getDb();
  if (action === "suspend") {
    const rows = await all(db, "UPDATE users SET suspended_at = NOW() WHERE id = ANY($1) AND suspended_at IS NULL RETURNING id, name, phone", [list]);
    if (rows.length) await run(db, "DELETE FROM sessions WHERE user_id = ANY($1)", [rows.map((row) => row.id)]);
    return rows;
  }
  if (action === "unsuspend") return all(db, "UPDATE users SET suspended_at = NULL WHERE id = ANY($1) AND suspended_at IS NOT NULL RETURNING id, name, phone", [list]);
  if (action === "logout") {
    const rows = await all(db, "SELECT id, name, phone FROM users WHERE id = ANY($1)", [list]);
    await run(db, "DELETE FROM sessions WHERE user_id = ANY($1)", [list]);
    return rows;
  }
  return [];
}

/** Ids of the accounts whose phone is in the given list (used to keep admins out of bulk actions). */
export async function userIdsByPhones(phones) {
  if (!phones.length) return [];
  const db = await getDb();
  return (await all(db, "SELECT id FROM users WHERE phone = ANY($1)", [phones])).map((row) => row.id);
}

const BOOKING_LIST = `
  SELECT 'salon' AS kind, b.id, u.id AS provider_id, u.name AS provider, b.client_user_id, b.client, b.phone, b.service, b.booking_date, b.time, b.duration_minutes, b.status, b.created_at
    FROM salon_bookings b LEFT JOIN users u ON u.id = b.salon_user_id
  UNION ALL
  SELECT 'artist', b.id, u.id, u.name, b.client_user_id, b.client_name, b.client_phone, b.service, b.booking_date, b.time, b.duration_minutes, b.status, b.created_at
    FROM artist_bookings b LEFT JOIN users u ON u.id = b.artist_user_id WHERE b.source_salon_user_id IS NULL
`;
export const ACTIVE_BOOKING_STATUSES = ["تازه", "درخواست", "تایید شده", "در انتظار مشتری"];

/**
 * Salon and artist bookings together (artist rows mirrored from a salon are skipped: they are the same booking), newest first.
 * `when`: today | upcoming | past (by the visit's own date, Tehran calendar). `kind`: salon | artist.
 */
export async function listBookings({ q = "", status = "", kind = "", when = "", limit = 25, offset = 0 } = {}) {
  const db = await getDb();
  const like = likeOf(q);
  const stat = String(status || "").slice(0, 40);
  const kd = ["salon", "artist"].includes(kind) ? kind : "";
  const wh = ["today", "upcoming", "past"].includes(when) ? when : "";
  const today = formatPersianDateKey(new Date());
  const where = `($1 = '' OR client ILIKE $1 OR phone LIKE $1 OR provider ILIKE $1 OR service ILIKE $1) AND ($2 = '' OR status = $2) AND ($3 = '' OR kind = $3)
    AND ($4 = '' OR ($4 = 'today' AND booking_date = $5) OR ($4 = 'upcoming' AND booking_date > $5) OR ($4 = 'past' AND booking_date < $5))`;
  const params = [like, stat, kd, wh, today];
  const order = wh === "upcoming" || wh === "today" ? "booking_date ASC, time ASC" : "created_at DESC";
  const [total, rows, statuses] = await Promise.all([
    get(db, `SELECT COUNT(*)::int AS count FROM (${BOOKING_LIST}) x WHERE ${where}`, params),
    all(db, `SELECT * FROM (${BOOKING_LIST}) x WHERE ${where} ORDER BY ${order} LIMIT $6 OFFSET $7`, [...params, clamp(limit, 1, 200, 25), Math.max(Number(offset) || 0, 0)]),
    all(db, `SELECT status, COUNT(*)::int AS count FROM (${BOOKING_LIST}) x GROUP BY status ORDER BY count DESC`)
  ]);
  return { total: total?.count || 0, bookings: rows, statuses, today };
}

/** One booking with both people behind it, for the booking detail panel. */
export async function getBookingDetail(kind, id) {
  const db = await getDb();
  const row = kind === "salon"
    ? await get(db, `
        SELECT 'salon' AS kind, b.id, b.salon_user_id AS provider_id, b.client_user_id, b.client AS client_name, b.phone AS client_phone, b.service, b.staff,
               b.booking_date, b.time, b.duration_minutes, b.status, b.created_at, NULL AS updated_at
        FROM salon_bookings b WHERE b.id = $1`, [Number(id)])
    : kind === "artist"
      ? await get(db, `
          SELECT 'artist' AS kind, b.id, b.artist_user_id AS provider_id, b.client_user_id, b.client_name, b.client_phone, b.service, '' AS staff,
                 b.booking_date, b.time, b.duration_minutes, b.status, b.created_at, b.updated_at, b.source_salon_user_id
          FROM artist_bookings b WHERE b.id = $1`, [Number(id)])
      : null;
  if (!row) return null;
  const people = await all(db, "SELECT id, name, phone, type, suspended_at FROM users WHERE id = ANY($1)", [[row.provider_id, row.client_user_id].filter(Boolean)]);
  const byId = Object.fromEntries(people.map((person) => [person.id, person]));
  const [history, reminders] = await Promise.all([
    all(db, "SELECT id, admin_label, action, detail, created_at FROM admin_actions WHERE action = 'booking_cancel' AND detail LIKE $1 ORDER BY id DESC LIMIT 5", [`${kind}#${row.id} %`]),
    all(db, "SELECT kind, sent_at FROM booking_reminders WHERE source = $1 AND booking_id = $2 ORDER BY sent_at", [kind, row.id]).catch(() => [])
  ]);
  return {
    booking: row,
    provider: byId[row.provider_id] || null,
    client: row.client_user_id ? byId[row.client_user_id] || null : null,
    history,
    reminders,
    cancellable: ACTIVE_BOOKING_STATUSES.includes(row.status) && !(row.booking_date && row.booking_date < formatPersianDateKey(new Date()))
  };
}

/**
 * The admin cancels a booking (a dispute, a fake request). Goes through the same paths the salon or a client use,
 * so artist calendars and freed slots stay right. Returns { ok, booking } or { ok: false, error }.
 */
export async function cancelBookingAsAdmin(kind, id) {
  const db = await getDb();
  if (kind === "salon") {
    const current = await get(db, "SELECT salon_user_id, status FROM salon_bookings WHERE id = $1", [Number(id)]);
    if (!current) return { ok: false, error: "missing" };
    if (!ACTIVE_BOOKING_STATUSES.includes(current.status)) return { ok: false, error: "inactive" };
    return cancelSalonBooking(Number(id), current.salon_user_id);
  }
  if (kind === "artist") {
    const current = await get(db, "SELECT * FROM artist_bookings WHERE id = $1 AND source_salon_user_id IS NULL", [Number(id)]);
    if (!current) return { ok: false, error: "missing" };
    if (current.booking_date && current.booking_date < formatPersianDateKey(new Date())) return { ok: false, error: "past" };
    const changed = await run(db, `
      UPDATE artist_bookings SET status = 'لغو', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status IN ('تازه', 'درخواست', 'تایید شده', 'در انتظار مشتری')
    `, [Number(id)]);
    if (!changed.rowCount) return { ok: false, error: "inactive" };
    return { ok: true, booking: { ...current, status: "لغو" } };
  }
  return { ok: false, error: "missing" };
}

/** Rows for a CSV export (capped). `kind`: users | bookings | actions. Phones are included: the route asks for a password re-check first. */
export async function exportRows(kind) {
  const db = await getDb();
  if (kind === "users") {
    return all(db, `
      SELECT id, name, phone, type, area, service, email, created_at, last_seen_at, suspended_at FROM users ORDER BY id LIMIT 50000
    `);
  }
  if (kind === "bookings") {
    return all(db, `SELECT kind, id, provider, client, phone, service, booking_date, time, duration_minutes, status, created_at FROM (${BOOKING_LIST}) x ORDER BY created_at DESC LIMIT 50000`);
  }
  if (kind === "actions") {
    return all(db, `
      SELECT a.id, a.created_at, a.admin_label, a.action, a.target_user_id, u.phone AS target_phone, a.detail
      FROM admin_actions a LEFT JOIN users u ON u.id = a.target_user_id ORDER BY a.id DESC LIMIT 50000
    `);
  }
  return null;
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

/** One search box for everything: accounts (name / phone), posts (title / caption) and support tickets (subject / text / phone), a handful of each. */
export async function searchAll(q) {
  const like = likeOf(q);
  if (String(q || "").trim().length < 3) return { users: [], posts: [], tickets: [] };
  await ensureSupportTables();
  const db = await getDb();
  const [people, posts, tickets] = await Promise.all([
    all(db, "SELECT id, name, phone, type, suspended_at FROM users WHERE name ILIKE $1 OR phone LIKE $1 OR email ILIKE $1 ORDER BY id DESC LIMIT 5", [like]),
    all(db, `SELECT p.id, p.title, p.is_public, u.name AS owner_name FROM posts p JOIN users u ON u.id = p.owner_user_id WHERE p.title ILIKE $1 OR p.caption ILIKE $1 ORDER BY p.id DESC LIMIT 5`, [like]),
    all(db, `
      SELECT t.id, t.kind, t.subject, t.status, COALESCE(NULLIF(t.contact_phone, ''), u.phone) AS phone, u.name AS user_name
      FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id
      WHERE t.subject ILIKE $1 OR t.body ILIKE $1 OR t.contact_phone LIKE $1 OR u.name ILIKE $1 OR u.phone LIKE $1
      ORDER BY t.last_message_at DESC LIMIT 5
    `, [like])
  ]);
  return { users: people, posts, tickets };
}

export async function killUserSessions(userId) {
  const db = await getDb();
  await run(db, "DELETE FROM sessions WHERE user_id = $1", [Number(userId)]);
}
