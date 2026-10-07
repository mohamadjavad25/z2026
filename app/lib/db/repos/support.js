import { getDb, all, get, run } from "../connection.js";

export const SUPPORT_CATEGORIES = ["question", "bug", "complaint", "account", "other"];
export const REPORT_REASONS = ["spam", "inappropriate", "fake", "copyright", "other"];
export const TICKET_STATUSES = ["open", "in_progress", "closed"];

let ready;
/** Creates the table on first use (same DDL as migrations/024_support.sql, idempotent): no manual database step on deploy. */
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
  })().catch((error) => {
    ready = undefined; // try again on the next request instead of caching a failure
    throw error;
  });
  return ready;
}

/** Creates a ticket. A second live report from the same person about the same target returns the existing one (`already: true`). */
export async function createTicket({ kind, userId = null, contactPhone = "", category = "other", subject = "", body = "", targetType = "", targetId = null }) {
  await ensureSupportTables();
  const db = await getDb();
  const row = await get(db, `
    INSERT INTO support_tickets (kind, user_id, contact_phone, category, subject, body, target_type, target_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (user_id, target_type, target_id) WHERE kind = 'report' AND status <> 'closed' DO NOTHING
    RETURNING id
  `, [kind, userId, contactPhone, category, subject, body, targetType, targetId]);
  if (row) return { id: row.id, already: false };
  const existing = await get(db, "SELECT id FROM support_tickets WHERE kind = 'report' AND user_id = $1 AND target_type = $2 AND target_id = $3 AND status <> 'closed'", [userId, targetType, targetId]);
  return { id: existing?.id ?? null, already: true };
}

const clamp = (value, min, max, fallback) => Math.min(Math.max(Number(value) || fallback, min), max);

export async function listTickets({ status = "", kind = "", q = "", limit = 25, offset = 0 } = {}) {
  await ensureSupportTables();
  const db = await getDb();
  const st = TICKET_STATUSES.includes(status) ? status : "";
  const kd = ["support", "report"].includes(kind) ? kind : "";
  const term = String(q || "").trim();
  const like = term ? `%${term.replace(/[%_\\]/g, "\\$&")}%` : "";
  const where = "($1 = '' OR t.status = $1) AND ($2 = '' OR t.kind = $2) AND ($3 = '' OR t.subject ILIKE $3 OR t.body ILIKE $3 OR t.contact_phone LIKE $3 OR u.name ILIKE $3 OR u.phone LIKE $3)";
  const params = [st, kd, like];
  const [total, rows, counts] = await Promise.all([
    get(db, `SELECT COUNT(*)::int AS count FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id WHERE ${where}`, params),
    all(db, `
      SELECT t.id, t.kind, t.category, t.subject, t.body, t.status, t.target_type, t.target_id, t.created_at, t.updated_at,
             u.id AS user_id, u.name AS user_name, COALESCE(NULLIF(t.contact_phone, ''), u.phone) AS phone
      FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id
      WHERE ${where}
      ORDER BY (t.status = 'closed'), t.created_at DESC
      LIMIT $4 OFFSET $5
    `, [...params, clamp(limit, 1, 100, 25), Math.max(Number(offset) || 0, 0)]),
    all(db, "SELECT status, COUNT(*)::int AS count FROM support_tickets GROUP BY status")
  ]);
  return { total: total?.count || 0, tickets: rows, counts: Object.fromEntries(counts.map((row) => [row.status, row.count])) };
}

/** One ticket with the person behind it and a small preview of what was reported. */
export async function getTicket(id) {
  await ensureSupportTables();
  const db = await getDb();
  const ticket = await get(db, `
    SELECT t.*, u.name AS user_name, u.phone AS user_phone, u.type AS user_type
    FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id WHERE t.id = $1
  `, [Number(id)]);
  if (!ticket) return null;
  let target = null;
  if (ticket.kind === "report" && ticket.target_type === "post") {
    target = await get(db, `
      SELECT p.id, p.title, p.caption, p.is_public, o.id AS owner_id, o.name AS owner_name, o.phone AS owner_phone, o.suspended_at AS owner_suspended_at
      FROM posts p JOIN users o ON o.id = p.owner_user_id WHERE p.id = $1
    `, [ticket.target_id]);
  } else if (ticket.kind === "report" && ticket.target_type === "user") {
    target = await get(db, "SELECT id, name, phone, type, suspended_at FROM users WHERE id = $1", [ticket.target_id]);
  }
  return { ticket, target: target || null };
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

/** Tickets still waiting for someone (open or in progress). */
export async function countActive() {
  await ensureSupportTables();
  const db = await getDb();
  return (await get(db, "SELECT COUNT(*)::int AS count FROM support_tickets WHERE status <> 'closed'"))?.count || 0;
}
