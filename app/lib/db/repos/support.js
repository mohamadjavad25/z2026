import { getDb, all, get, run } from "../connection.js";

export const SUPPORT_CATEGORIES = ["question", "bug", "complaint", "account", "other"];
export const REPORT_REASONS = ["spam", "inappropriate", "fake", "copyright", "other"];
export const TICKET_STATUSES = ["open", "in_progress", "closed"];

/**
 * A ticket is a conversation. `last_actor` says who wrote last, which gives the two states people care about:
 *   - waiting for the admin: not closed and the user wrote last
 *   - waiting for the user:  not closed and the admin wrote last
 * `user_read_at` marks when the owner last opened it, so "you have a reply" is simply admin-wrote-last and newer than that.
 */
let ready;
/** Creates / upgrades the tables on first use (same DDL as migrations 024 + 025, idempotent): no manual database step on deploy. */
export function ensureSupportTables() {
  ready ??= (async () => {
    const db = await getDb();
    await run(db, `CREATE TABLE IF NOT EXISTS support_tickets (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('support', 'report')),
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      contact_phone TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'other',
      subject TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      target_type TEXT NOT NULL DEFAULT '' CHECK (target_type IN ('', 'post', 'user')),
      target_id INTEGER,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
      admin_note TEXT NOT NULL DEFAULT '',
      resolution TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ
    )`);
    await run(db, "CREATE INDEX IF NOT EXISTS idx_support_status_created ON support_tickets (status, created_at DESC)");
    await run(db, "CREATE UNIQUE INDEX IF NOT EXISTS idx_support_report_once ON support_tickets (user_id, target_type, target_id) WHERE kind = 'report' AND status <> 'closed'");
    await run(db, "ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS last_actor TEXT NOT NULL DEFAULT 'user'");
    await run(db, "ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()");
    await run(db, "ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS user_read_at TIMESTAMPTZ");
    await run(db, "ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS from_admin BOOLEAN NOT NULL DEFAULT FALSE");
    await run(db, `CREATE TABLE IF NOT EXISTS support_messages (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      author TEXT NOT NULL CHECK (author IN ('user', 'admin')),
      author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await run(db, "CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages (ticket_id, id)");
    await run(db, "CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets (user_id, last_message_at DESC)");
    await run(db, `
      INSERT INTO support_messages (ticket_id, author, author_user_id, body, created_at)
      SELECT t.id, 'user', t.user_id, t.body, t.created_at FROM support_tickets t
      WHERE t.body <> '' AND NOT EXISTS (SELECT 1 FROM support_messages m WHERE m.ticket_id = t.id)
    `);
  })().catch((error) => {
    ready = undefined; // try again on the next request instead of caching a failure
    throw error;
  });
  return ready;
}

const clamp = (value, min, max, fallback) => Math.min(Math.max(Number(value) || fallback, min), max);
const clip = (text, max) => String(text || "").trim().slice(0, max);

/** Creates a ticket (a user's message or a report) with its first message. A second live report from the same person about the same target returns the existing one (`already: true`). */
export async function createTicket({ kind, userId = null, contactPhone = "", category = "other", subject = "", body = "", targetType = "", targetId = null }) {
  await ensureSupportTables();
  const db = await getDb();
  const row = await get(db, `
    INSERT INTO support_tickets (kind, user_id, contact_phone, category, subject, body, target_type, target_id, user_read_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (user_id, target_type, target_id) WHERE kind = 'report' AND status <> 'closed' DO NOTHING
    RETURNING id
  `, [kind, userId, contactPhone, category, subject, body, targetType, targetId]);
  if (row) {
    if (body) await run(db, "INSERT INTO support_messages (ticket_id, author, author_user_id, body) VALUES ($1, 'user', $2, $3)", [row.id, userId, body]);
    return { id: row.id, already: false };
  }
  const existing = await get(db, "SELECT id FROM support_tickets WHERE kind = 'report' AND user_id = $1 AND target_type = $2 AND target_id = $3 AND status <> 'closed'", [userId, targetType, targetId]);
  return { id: existing?.id ?? null, already: true };
}

/** The admin starts a conversation with a user. It shows up in that user's support center as an unread message from support. */
export async function createAdminTicket({ userId, phone = "", subject = "", body, adminUserId = null }) {
  await ensureSupportTables();
  const db = await getDb();
  const row = await get(db, `
    INSERT INTO support_tickets (kind, user_id, contact_phone, category, subject, body, status, last_actor, from_admin)
    VALUES ('support', $1, $2, 'other', $3, '', 'in_progress', 'admin', TRUE) RETURNING id
  `, [userId, phone, clip(subject, 120)]);
  await run(db, "INSERT INTO support_messages (ticket_id, author, author_user_id, body) VALUES ($1, 'admin', $2, $3)", [row.id, adminUserId, clip(body, 2000)]);
  return { id: row.id };
}

/**
 * Appends a message and moves the ticket along: a user's message reopens a closed ticket; an admin's first reply moves an
 * open ticket to "in progress". Returns the updated ticket row, or null when it does not exist.
 */
export async function addMessage({ ticketId, author, authorUserId = null, body }) {
  await ensureSupportTables();
  const db = await getDb();
  const text = clip(body, 2000);
  if (!text) return null;
  const exists = await get(db, "SELECT id FROM support_tickets WHERE id = $1", [Number(ticketId)]);
  if (!exists) return null;
  await run(db, "INSERT INTO support_messages (ticket_id, author, author_user_id, body) VALUES ($1, $2, $3, $4)", [Number(ticketId), author, authorUserId, text]);
  return (await get(db, `
    UPDATE support_tickets SET
      last_actor = $2,
      last_message_at = NOW(),
      updated_at = NOW(),
      status = CASE WHEN $2 = 'user' AND status = 'closed' THEN 'open' WHEN $2 = 'admin' AND status = 'open' THEN 'in_progress' ELSE status END,
      closed_at = CASE WHEN $2 = 'user' THEN NULL ELSE closed_at END,
      user_read_at = CASE WHEN $2 = 'user' THEN NOW() ELSE user_read_at END
    WHERE id = $1 RETURNING id, user_id, status, subject, last_actor
  `, [Number(ticketId), author])) || null;
}

/** The admin inbox. Tickets waiting for the admin come first, then the ones waiting for the user, then closed ones. */
export async function listTickets({ status = "", kind = "", q = "", awaiting = "", limit = 25, offset = 0 } = {}) {
  await ensureSupportTables();
  const db = await getDb();
  const st = TICKET_STATUSES.includes(status) ? status : "";
  const kd = ["support", "report"].includes(kind) ? kind : "";
  const wait = awaiting === "admin" || awaiting === "user" ? awaiting : "";
  const term = String(q || "").trim();
  const like = term ? `%${term.replace(/[%_\\]/g, "\\$&")}%` : "";
  const where = `($1 = '' OR t.status = $1) AND ($2 = '' OR t.kind = $2)
    AND ($3 = '' OR t.subject ILIKE $3 OR t.body ILIKE $3 OR t.contact_phone LIKE $3 OR u.name ILIKE $3 OR u.phone LIKE $3)
    AND ($4 = '' OR (t.status <> 'closed' AND t.last_actor = CASE WHEN $4 = 'admin' THEN 'user' ELSE 'admin' END))`;
  const params = [st, kd, like, wait];
  const [total, rows, counts] = await Promise.all([
    get(db, `SELECT COUNT(*)::int AS count FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id WHERE ${where}`, params),
    all(db, `
      SELECT t.id, t.kind, t.category, t.subject, t.status, t.target_type, t.target_id, t.created_at, t.updated_at, t.last_actor, t.last_message_at, t.from_admin,
             (t.status <> 'closed' AND t.last_actor = 'user') AS awaiting_admin,
             (SELECT m.body FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_body,
             u.id AS user_id, u.name AS user_name, COALESCE(NULLIF(t.contact_phone, ''), u.phone) AS phone
      FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id
      WHERE ${where}
      ORDER BY (t.status = 'closed'), (t.last_actor <> 'user'), t.last_message_at DESC
      LIMIT $5 OFFSET $6
    `, [...params, clamp(limit, 1, 100, 25), Math.max(Number(offset) || 0, 0)]),
    get(db, `
      SELECT COUNT(*) FILTER (WHERE status = 'open')::int AS open, COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
             COUNT(*) FILTER (WHERE status = 'closed')::int AS closed,
             COUNT(*) FILTER (WHERE status <> 'closed' AND last_actor = 'user')::int AS awaiting_admin,
             COUNT(*) FILTER (WHERE status <> 'closed' AND last_actor = 'admin')::int AS awaiting_user
      FROM support_tickets
    `)
  ]);
  return { total: total?.count || 0, tickets: rows, counts: counts || {} };
}

/** One ticket for the admin: the conversation, the person behind it and a small preview of what was reported. */
export async function getTicket(id) {
  await ensureSupportTables();
  const db = await getDb();
  const ticket = await get(db, `
    SELECT t.*, u.name AS user_name, u.phone AS user_phone, u.type AS user_type
    FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id WHERE t.id = $1
  `, [Number(id)]);
  if (!ticket) return null;
  const messages = await all(db, "SELECT id, author, body, created_at FROM support_messages WHERE ticket_id = $1 ORDER BY id", [ticket.id]);
  let target = null;
  if (ticket.kind === "report" && ticket.target_type === "post") {
    target = await get(db, `
      SELECT p.id, p.title, p.caption, p.is_public, o.id AS owner_id, o.name AS owner_name, o.phone AS owner_phone, o.suspended_at AS owner_suspended_at
      FROM posts p JOIN users o ON o.id = p.owner_user_id WHERE p.id = $1
    `, [ticket.target_id]);
  } else if (ticket.kind === "report" && ticket.target_type === "user") {
    target = await get(db, "SELECT id, name, phone, type, suspended_at FROM users WHERE id = $1", [ticket.target_id]);
  }
  return { ticket, messages, target: target || null };
}

export async function updateTicket(id, { status, adminNote, resolution }) {
  await ensureSupportTables();
  const db = await getDb();
  const st = TICKET_STATUSES.includes(status) ? status : null;
  return (await get(db, `
    UPDATE support_tickets SET
      status = COALESCE($2, status),
      admin_note = COALESCE($3, admin_note),
      resolution = COALESCE($4, resolution),
      updated_at = NOW(),
      closed_at = CASE WHEN COALESCE($2, status) = 'closed' THEN COALESCE(closed_at, NOW()) ELSE NULL END
    WHERE id = $1 RETURNING id, status, admin_note, resolution
  `, [Number(id), st, adminNote === undefined ? null : String(adminNote).slice(0, 2000), resolution === undefined ? null : String(resolution).slice(0, 60)])) || null;
}

/** Tickets waiting for the admin to answer (not closed, user wrote last): the number behind the badge. */
export async function countActive() {
  await ensureSupportTables();
  const db = await getDb();
  return (await get(db, "SELECT COUNT(*)::int AS count FROM support_tickets WHERE status <> 'closed' AND last_actor = 'user'"))?.count || 0;
}

/* ---- the user's side ---- */

/** A user's own tickets, newest activity first, with a snippet of the last message and whether there is an unread reply. */
export async function listUserTickets(userId) {
  await ensureSupportTables();
  const db = await getDb();
  return all(db, `
    SELECT t.id, t.kind, t.category, t.subject, t.status, t.target_type, t.from_admin, t.last_actor, t.last_message_at, t.created_at,
           (t.last_actor = 'admin' AND (t.user_read_at IS NULL OR t.user_read_at < t.last_message_at)) AS unread,
           (SELECT m.body FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_body
    FROM support_tickets t WHERE t.user_id = $1
    ORDER BY t.last_message_at DESC LIMIT 100
  `, [Number(userId)]);
}

/** One of the user's own tickets with its messages. Opening it marks it as read. Returns null for someone else's ticket. */
export async function getUserTicket(userId, ticketId) {
  await ensureSupportTables();
  const db = await getDb();
  const ticket = await get(db, `
    UPDATE support_tickets SET user_read_at = NOW()
    WHERE id = $1 AND user_id = $2
    RETURNING id, kind, category, subject, status, target_type, from_admin, created_at, last_actor, resolution
  `, [Number(ticketId), Number(userId)]);
  if (!ticket) return null;
  const messages = await all(db, "SELECT id, author, body, created_at FROM support_messages WHERE ticket_id = $1 ORDER BY id", [ticket.id]);
  return { ticket, messages };
}

export async function countUserUnread(userId) {
  await ensureSupportTables();
  const db = await getDb();
  return (await get(db, `
    SELECT COUNT(*)::int AS count FROM support_tickets
    WHERE user_id = $1 AND last_actor = 'admin' AND (user_read_at IS NULL OR user_read_at < last_message_at)
  `, [Number(userId)]))?.count || 0;
}
