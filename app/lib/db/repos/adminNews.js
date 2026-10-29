import { getDb, all, get, run } from "../connection.js";

/**
 * Storage for the operator's news (app/lib/adminNews.js): one row per kind (migrations/064_admin_news.sql, also
 * created on first use like adminControl.js). The counts are never kept here; they are read from the real tables
 * (`todayCounts`), so a lost push or a restart can never make a number wrong.
 */

const TZ = "Asia/Tehran";
const TODAY = `(date_trunc('day', NOW() AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}')`;

let ready;
function ensureTable() {
  ready ??= (async () => {
    const db = await getDb();
    await run(db, `CREATE TABLE IF NOT EXISTS admin_news (
      kind TEXT PRIMARY KEY,
      pending BOOLEAN NOT NULL DEFAULT FALSE,
      last_label TEXT NOT NULL DEFAULT '',
      last_push_at TIMESTAMPTZ,
      state JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  })().catch((error) => { ready = undefined; throw error; });
  return ready;
}

/** Something new happened: remember it is waiting to be told, and the name to show. */
export async function markPending(kind, label) {
  await ensureTable();
  const db = await getDb();
  await run(db, `
    INSERT INTO admin_news (kind, pending, last_label, updated_at) VALUES ($1, TRUE, $2, NOW())
    ON CONFLICT (kind) DO UPDATE SET pending = TRUE, last_label = CASE WHEN $2 = '' THEN admin_news.last_label ELSE $2 END, updated_at = NOW()
  `, [kind, String(label || "").slice(0, 60)]);
}

/**
 * Takes the right to ring the phone for `kind`, if something is waiting and the last ring was at least `gapMs` ago.
 * One UPDATE, so two copies of the app (scripts/start-app.mjs) or the cron and a request can never both ring.
 * Returns the row (with its label) when taken, else null.
 */
export async function claim(kind, gapMs) {
  await ensureTable();
  const db = await getDb();
  return (await get(db, `
    UPDATE admin_news SET pending = FALSE, last_push_at = NOW(), updated_at = NOW()
    WHERE kind = $1 AND pending AND (last_push_at IS NULL OR last_push_at <= NOW() - ($2::int * INTERVAL '1 millisecond'))
    RETURNING kind, last_label
  `, [kind, Math.round(gapMs)])) || null;
}

/** Kinds with something still waiting to be told. */
export async function listPending() {
  await ensureTable();
  const db = await getDb();
  return (await all(db, "SELECT kind FROM admin_news WHERE pending")).map((row) => row.kind);
}

/** The small saved state of one kind (the server watch and the nightly summary use it). */
export async function readState(kind) {
  await ensureTable();
  const db = await getDb();
  return (await get(db, "SELECT state FROM admin_news WHERE kind = $1", [kind]))?.state || {};
}

export async function writeState(kind, state) {
  await ensureTable();
  const db = await getDb();
  await run(db, `
    INSERT INTO admin_news (kind, state, updated_at) VALUES ($1, $2::jsonb, NOW())
    ON CONFLICT (kind) DO UPDATE SET state = $2::jsonb, updated_at = NOW()
  `, [kind, JSON.stringify(state || {})]);
}

/**
 * Today's numbers (Tehran day, from midnight). Bookings are the ones clients sent (salon_bookings and the artist's own
 * bookings with a client account, not copies a salon placed on its artist); payments leave out the sandbox's test ones.
 */
export async function todayCounts() {
  const db = await getDb();
  const [signups, bookings, payments, tickets] = await Promise.all([
    all(db, `SELECT type, COUNT(*)::int AS count FROM users WHERE created_at >= ${TODAY} GROUP BY type`),
    all(db, `
      SELECT status, COUNT(*)::int AS count FROM (
        SELECT status FROM salon_bookings WHERE client_user_id IS NOT NULL AND created_at >= ${TODAY}
        UNION ALL
        SELECT status FROM artist_bookings WHERE client_user_id IS NOT NULL AND source_salon_user_id IS NULL AND created_at >= ${TODAY}
      ) x GROUP BY status
    `),
    get(db, `
      SELECT COUNT(*)::int AS count, COALESCE(SUM(amount_rial), 0)::bigint AS rial FROM payments
      WHERE status = 'paid' AND source = 'gateway' AND gateway <> 'sandbox' AND paid_at >= ${TODAY}
    `).catch(() => ({ count: 0, rial: 0 })),
    get(db, "SELECT COUNT(*)::int AS count FROM support_tickets WHERE status <> 'closed' AND last_actor = 'user'").catch(() => ({ count: 0 }))
  ]);
  return {
    signups: Object.fromEntries(signups.map((row) => [row.type, row.count])),
    bookings: Object.fromEntries(bookings.map((row) => [row.status, row.count])),
    payments: { count: Number(payments?.count || 0), rial: Number(payments?.rial || 0) },
    openTickets: Number(tickets?.count || 0)
  };
}
