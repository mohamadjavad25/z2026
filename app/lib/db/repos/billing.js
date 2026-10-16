import { randomBytes } from "node:crypto";
import { getDb, all, get, run, withTransaction } from "../connection.js";
import { getSetting, saveSetting } from "./adminControl.js";
import { computeAccess, nextPeriod, receiptNumber } from "../../billing/period.js";
import { DEFAULT_GRACE_DAYS, isBilledRole, rialToToman } from "../../billing/plans.js";

/**
 * Subscriptions and payments for salons and artists. The only file that writes money-related rows.
 *
 * Rules every function here keeps:
 *  - A payment's amount, plan and length are copied onto its row when it is created; later price changes never
 *    touch it.
 *  - A pending payment becomes "paid" in exactly one transaction that locks the payment row and then the account's
 *    subscription row, so two callbacks, a callback and the cron, or two payments of the same account settle one at
 *    a time and a payment can never extend a subscription twice.
 *  - Status only moves forward: pending -> paid or pending -> failed. A paid or failed row is never changed again.
 */

export const BILLING_DDL = [
  `CREATE TABLE IF NOT EXISTS subscriptions (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  paid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`,
  `CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_type TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  user_phone TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL,
  plan_title TEXT NOT NULL DEFAULT '',
  days INTEGER NOT NULL CHECK (days > 0),
  amount_rial BIGINT NOT NULL CHECK (amount_rial >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  source TEXT NOT NULL DEFAULT 'gateway' CHECK (source IN ('gateway', 'admin')),
  gateway TEXT NOT NULL DEFAULT '',
  authority TEXT,
  ref_id TEXT,
  card_pan TEXT NOT NULL DEFAULT '',
  gateway_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  return_token TEXT UNIQUE,
  receipt_no TEXT UNIQUE,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  failure TEXT NOT NULL DEFAULT '',
  verify_attempts INTEGER NOT NULL DEFAULT 0,
  last_verify_at TIMESTAMPTZ,
  note TEXT NOT NULL DEFAULT '',
  admin_label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`,
  "CREATE UNIQUE INDEX IF NOT EXISTS payments_gateway_authority ON payments (gateway, authority) WHERE authority IS NOT NULL;",
  "CREATE UNIQUE INDEX IF NOT EXISTS payments_gateway_ref ON payments (gateway, ref_id) WHERE ref_id IS NOT NULL;",
  "CREATE INDEX IF NOT EXISTS idx_payments_user ON payments (user_id, id DESC);",
  "CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status, created_at DESC);",
  "CREATE INDEX IF NOT EXISTS idx_payments_paid ON payments (paid_at DESC) WHERE status = 'paid';",
  `CREATE TABLE IF NOT EXISTS billing_notices (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, kind, period_end)
);`
];

/** Creates the tables on first use (same DDL as migrations/033_billing.sql, checked by tests/unit/billingSchema.test.js). */
let ready;
export function ensureBillingTables() {
  ready ??= (async () => {
    const db = await getDb();
    for (const statement of BILLING_DDL) await run(db, statement);
  })().catch((error) => {
    ready = undefined; // retry on the next request instead of caching a failure
    throw error;
  });
  return ready;
}

/* ───────────────────────── settings ───────────────────────── */

const clampGrace = (value) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 14) : DEFAULT_GRACE_DAYS;
};

// Directory lists read this on every request, so it is kept for a few seconds per server instance. Saving clears it
// here at once; other instances pick a change up within SETTINGS_TTL_MS.
const SETTINGS_TTL_MS = 10_000;
let settingsCache = null;

export async function getBillingSettings({ fresh = false } = {}) {
  if (!fresh && settingsCache && Date.now() - settingsCache.at < SETTINGS_TTL_MS) return settingsCache.value;
  const saved = await getSetting("billing");
  const value = {
    enabled: saved?.enabled === true,
    launchedAt: saved?.launchedAt || null,
    graceDays: clampGrace(saved?.graceDays ?? DEFAULT_GRACE_DAYS),
    salonCoversArtists: saved?.salonCoversArtists !== false,
    updatedAt: saved?.updatedAt || null,
    updatedBy: saved?.updatedBy || ""
  };
  settingsCache = { at: Date.now(), value };
  return value;
}

/** `launchedAt` is set the first time billing is switched on and is kept from then on, even if billing is switched off and on again. */
export async function saveBillingSettings({ enabled, graceDays, salonCoversArtists }, label = "") {
  const current = await getBillingSettings({ fresh: true });
  const launchedAt = current.launchedAt || (enabled ? new Date().toISOString() : null);
  await saveSetting("billing", { enabled: Boolean(enabled), graceDays: clampGrace(graceDays), salonCoversArtists: Boolean(salonCoversArtists), launchedAt }, label);
  settingsCache = null;
  return getBillingSettings({ fresh: true });
}

/* ───────────────────────── account state ───────────────────────── */

function accessOf(user, paidUntil, settings, now) {
  return computeAccess({ now, createdAt: user.created_at, launchedAt: settings.launchedAt, paidUntil, graceDays: settings.graceDays });
}

/**
 * For artists: the salons whose subscription covers them (they are on the salon's team and the salon's access is
 * open). Returns Map(artistId -> { salonId, salonName }), first covering salon only.
 */
async function salonCover(db, artistIds, settings, now) {
  const cover = new Map();
  if (!artistIds.length || !settings.salonCoversArtists) return cover;
  const rows = await all(db, `
    SELECT st.artist_user_id, u.id AS salon_id, COALESCE(NULLIF(sa.name, ''), NULLIF(u.name, ''), 'سالن') AS salon_name,
           u.created_at, sub.paid_until
    FROM salon_staff st
    JOIN users u ON u.id = st.salon_user_id AND u.type = 'salon'
    LEFT JOIN salons sa ON sa.user_id = u.id
    LEFT JOIN subscriptions sub ON sub.user_id = u.id
    WHERE st.artist_user_id = ANY($1::int[])
    ORDER BY st.id
  `, [artistIds]);
  for (const row of rows) {
    if (cover.has(row.artist_user_id)) continue;
    if (accessOf(row, row.paid_until, settings, now).open) cover.set(row.artist_user_id, { salonId: row.salon_id, salonName: row.salon_name });
  }
  return cover;
}

/** The subscription picture for one salon or artist account, or null for anyone else (clients never pay). */
export async function getAccountState(userId, now = new Date()) {
  await ensureBillingTables();
  const db = await getDb();
  const user = await get(db, "SELECT id, type, name, phone, created_at FROM users WHERE id = $1", [Number(userId)]);
  if (!user || !isBilledRole(user.type)) return null;
  const [settings, sub] = await Promise.all([
    getBillingSettings(),
    get(db, "SELECT paid_until FROM subscriptions WHERE user_id = $1", [user.id])
  ]);
  const access = accessOf(user, sub?.paid_until || null, settings, now);
  const coveredBy = user.type === "artist" ? (await salonCover(db, [user.id], settings, now)).get(user.id) || null : null;
  return { user, settings, access, coveredBy, open: access.open || Boolean(coveredBy) };
}

/** Of `userIds`, the salon and artist accounts whose access is closed (not covered by a salon either). One batch, for directory lists. */
export async function closedAccountIds(userIds, now = new Date()) {
  const ids = [...new Set(userIds.map(Number).filter(Boolean))];
  if (!ids.length) return new Set();
  await ensureBillingTables();
  const db = await getDb();
  const [settings, rows] = await Promise.all([
    getBillingSettings(),
    all(db, `
      SELECT u.id, u.type, u.created_at, sub.paid_until
      FROM users u LEFT JOIN subscriptions sub ON sub.user_id = u.id
      WHERE u.id = ANY($1::int[]) AND u.type IN ('salon', 'artist')
    `, [ids])
  ]);
  const closed = rows.filter((row) => !accessOf(row, row.paid_until, settings, now).open);
  const artists = closed.filter((row) => row.type === "artist").map((row) => row.id);
  const cover = await salonCover(db, artists, settings, now);
  return new Set(closed.filter((row) => !cover.has(row.id)).map((row) => row.id));
}

/* ───────────────────────── payments ───────────────────────── */

const newToken = () => randomBytes(24).toString("base64url");

/** A checkout attempt: pending, no gateway token yet. The plan's amount and length are copied here and never re-read. */
export async function createPayment({ user, plan, gateway }) {
  await ensureBillingTables();
  const db = await getDb();
  return get(db, `
    INSERT INTO payments (user_id, user_type, user_name, user_phone, plan, plan_title, days, amount_rial, gateway, return_token)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, [user.id, user.type, String(user.name || "").slice(0, 120), String(user.phone || ""), plan.id, plan.title, plan.days, plan.amountRial, gateway, newToken()]);
}

/** Stores the gateway's token for this checkout (once), plus anything the gateway needs to remember about it. */
export async function attachAuthority(paymentId, authority, payload = {}) {
  const db = await getDb();
  return get(db, `
    UPDATE payments SET authority = $2, gateway_payload = gateway_payload || $3::jsonb, updated_at = NOW()
    WHERE id = $1 AND status = 'pending' AND authority IS NULL
    RETURNING *
  `, [Number(paymentId), String(authority), JSON.stringify(payload || {})]);
}

export async function mergePaymentPayload(paymentId, payload) {
  const db = await getDb();
  return get(db, `
    UPDATE payments SET gateway_payload = gateway_payload || $2::jsonb, updated_at = NOW() WHERE id = $1 RETURNING *
  `, [Number(paymentId), JSON.stringify(payload || {})]);
}

/** Closes a still-pending payment as failed (e.g. the gateway refused to start it). A settled row is left alone. */
export async function failPayment(paymentId, failure, detail = "") {
  const db = await getDb();
  return get(db, `
    UPDATE payments SET status = 'failed', failure = $2, gateway_payload = gateway_payload || $3::jsonb, updated_at = NOW()
    WHERE id = $1 AND status = 'pending'
    RETURNING *
  `, [Number(paymentId), String(failure).slice(0, 200), JSON.stringify(detail ? { detail: String(detail).slice(0, 300) } : {})]);
}

export async function getPayment(paymentId) {
  await ensureBillingTables();
  const db = await getDb();
  return get(db, "SELECT * FROM payments WHERE id = $1", [Number(paymentId)]);
}

export async function getPaymentByToken(token) {
  const value = String(token || "");
  if (value.length < 20 || value.length > 64) return null;
  await ensureBillingTables();
  const db = await getDb();
  return get(db, "SELECT * FROM payments WHERE return_token = $1", [value]);
}

export async function getPaymentByAuthority(gateway, authority) {
  if (!authority) return null;
  await ensureBillingTables();
  const db = await getDb();
  return get(db, "SELECT * FROM payments WHERE gateway = $1 AND authority = $2", [String(gateway), String(authority)]);
}

/**
 * Applies a gateway's verification answer to a pending payment, atomically.
 *   verification.status "paid":    the account's access is extended by the plan's days (from the later of now and
 *                                  the current access end) and the payment gets its receipt number.
 *   verification.status "failed":  the payment is closed as failed with `failure` (Persian, shown to the user).
 *   verification.status "unknown": nothing is decided (gateway unreachable); the attempt is counted and the cron
 *                                  asks again later.
 * Returns { payment, settled } where settled says whether THIS call moved the payment out of pending (so the caller
 * sends the receipt and the admin notice exactly once).
 */
export async function settlePayment(paymentId, verification, now = new Date()) {
  await ensureBillingTables();
  const settings = await getBillingSettings();
  return withTransaction(null, async (client) => {
    const payment = await get(client, "SELECT * FROM payments WHERE id = $1 FOR UPDATE", [Number(paymentId)]);
    if (!payment) return { payment: null, settled: false };
    if (payment.status !== "pending") return { payment, settled: false };

    const detail = String(verification?.detail || "").slice(0, 300);
    if (verification?.status === "unknown" || !verification?.status) {
      const updated = await get(client, `
        UPDATE payments SET verify_attempts = verify_attempts + 1, last_verify_at = $2,
               gateway_payload = gateway_payload || $3::jsonb, updated_at = NOW()
        WHERE id = $1 RETURNING *
      `, [payment.id, now, JSON.stringify(detail ? { detail } : {})]);
      return { payment: updated, settled: false };
    }

    const amountOk = verification.amountRial === undefined || verification.amountRial === null || Number(verification.amountRial) === Number(payment.amount_rial);
    if (verification.status !== "paid" || !amountOk) {
      const failure = !amountOk ? "مبلغ پرداخت‌شده با مبلغ اشتراک یکی نبود." : String(verification.failure || "پرداخت انجام نشد.").slice(0, 200);
      const updated = await get(client, `
        UPDATE payments SET status = 'failed', failure = $2, verify_attempts = verify_attempts + 1, last_verify_at = $3,
               gateway_payload = gateway_payload || $4::jsonb, updated_at = NOW()
        WHERE id = $1 RETURNING *
      `, [payment.id, failure, now, JSON.stringify({ detail: detail || failure, ...(amountOk ? {} : { paidAmountRial: Number(verification.amountRial) }) })]);
      return { payment: updated, settled: true };
    }

    // Paid. Extend the account (if it still exists), then close the payment with its receipt number.
    let period = { start: null, end: null };
    if (payment.user_id) {
      const user = await get(client, "SELECT id, type, created_at FROM users WHERE id = $1", [payment.user_id]);
      if (user) {
        await run(client, "INSERT INTO subscriptions (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [user.id]);
        const sub = await get(client, "SELECT paid_until FROM subscriptions WHERE user_id = $1 FOR UPDATE", [user.id]);
        const access = accessOf(user, sub?.paid_until || null, settings, now);
        period = nextPeriod({ now, accessEndsAt: access.accessEndsAt, days: payment.days });
        await run(client, "UPDATE subscriptions SET paid_until = $2, updated_at = NOW() WHERE user_id = $1", [user.id, period.end]);
      }
    }
    const updated = await get(client, `
      UPDATE payments SET status = 'paid', ref_id = $2, card_pan = $3, paid_at = $4, period_start = $5, period_end = $6,
             receipt_no = $7, failure = '', verify_attempts = verify_attempts + 1, last_verify_at = $4,
             gateway_payload = gateway_payload || $8::jsonb, updated_at = NOW()
      WHERE id = $1 RETURNING *
    `, [
      payment.id,
      verification.refId ? String(verification.refId).slice(0, 80) : null,
      String(verification.cardPan || "").slice(0, 40),
      now,
      period.start,
      period.end,
      receiptNumber(payment.id, now),
      JSON.stringify(detail ? { detail } : {})
    ]);
    return { payment: updated, settled: true };
  });
}

/**
 * An admin adds days to an account: a gift (amount 0) or a payment taken outside the app (card-to-card, cash).
 * Recorded in the same ledger with source "admin", so the account's history and the reports stay complete.
 */
export async function grantDays({ userId, days, amountRial = 0, note = "", adminLabel = "", now = new Date() }) {
  await ensureBillingTables();
  const settings = await getBillingSettings();
  return withTransaction(null, async (client) => {
    const user = await get(client, "SELECT id, type, name, phone, created_at FROM users WHERE id = $1", [Number(userId)]);
    if (!user || !isBilledRole(user.type)) return { ok: false, error: "فقط برای حساب سالن یا آرتیست." };
    await run(client, "INSERT INTO subscriptions (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [user.id]);
    const sub = await get(client, "SELECT paid_until FROM subscriptions WHERE user_id = $1 FOR UPDATE", [user.id]);
    const access = accessOf(user, sub?.paid_until || null, settings, now);
    const period = nextPeriod({ now, accessEndsAt: access.accessEndsAt, days });
    await run(client, "UPDATE subscriptions SET paid_until = $2, updated_at = NOW() WHERE user_id = $1", [user.id, period.end]);
    const inserted = await get(client, `
      INSERT INTO payments (user_id, user_type, user_name, user_phone, plan, plan_title, days, amount_rial, status, source,
                            paid_at, period_start, period_end, note, admin_label, return_token)
      VALUES ($1, $2, $3, $4, 'admin', $5, $6, $7, 'paid', 'admin', $8, $9, $10, $11, $12, $13)
      RETURNING id
    `, [
      user.id, user.type, String(user.name || "").slice(0, 120), String(user.phone || ""),
      Number(amountRial) > 0 ? "پرداخت ثبت‌شده توسط مدیر" : "روز هدیه از طرف فرفرو",
      Number(days), Math.max(0, Math.round(Number(amountRial) || 0)), now, period.start, period.end,
      String(note || "").slice(0, 300), String(adminLabel || "").slice(0, 40), newToken()
    ]);
    const payment = await get(client, "UPDATE payments SET receipt_no = $2 WHERE id = $1 RETURNING *", [inserted.id, receiptNumber(inserted.id, now)]);
    return { ok: true, payment };
  });
}

export async function listUserPayments(userId, limit = 50) {
  await ensureBillingTables();
  const db = await getDb();
  return all(db, "SELECT * FROM payments WHERE user_id = $1 ORDER BY id DESC LIMIT $2", [Number(userId), Math.min(Math.max(Number(limit) || 50, 1), 100)]);
}

/** The newest still-open checkout of this account (within `maxMinutes`), if any: the app shows «در حال بررسی» for it. */
export async function latestPendingPayment(userId, maxMinutes = 120) {
  await ensureBillingTables();
  const db = await getDb();
  return get(db, `
    SELECT * FROM payments WHERE user_id = $1 AND status = 'pending' AND authority IS NOT NULL
      AND created_at >= NOW() - ($2::int * INTERVAL '1 minute')
    ORDER BY id DESC LIMIT 1
  `, [Number(userId), Number(maxMinutes)]);
}

/* ───────────────────────── cron helpers ───────────────────────── */

/** Pending checkouts worth asking the gateway about again: started (have a token), a few minutes old, not asked in the last 5 minutes. */
export async function listPaymentsToReverify(now = new Date(), limit = 40) {
  await ensureBillingTables();
  const db = await getDb();
  return all(db, `
    SELECT * FROM payments
    WHERE status = 'pending' AND source = 'gateway' AND authority IS NOT NULL
      AND created_at <= $1::timestamptz - INTERVAL '3 minutes'
      AND (last_verify_at IS NULL OR last_verify_at <= $1::timestamptz - INTERVAL '5 minutes')
    ORDER BY created_at LIMIT $2
  `, [now, limit]);
}

/** Checkouts that never reached the gateway (no token) or that nobody could settle for three days: closed as failed. */
export async function closeAbandonedPayments(now = new Date()) {
  await ensureBillingTables();
  const db = await getDb();
  const result = await run(db, `
    UPDATE payments SET status = 'failed', failure = 'پرداخت کامل نشد.', updated_at = NOW()
    WHERE status = 'pending' AND source = 'gateway' AND (
      (authority IS NULL AND created_at <= $1::timestamptz - INTERVAL '30 minutes')
      OR created_at <= $1::timestamptz - INTERVAL '3 days'
    )
  `, [now]);
  return result.rowCount;
}

/** Every salon and artist with what the reminders need (suspended accounts get none). */
export async function listBilledAccounts() {
  await ensureBillingTables();
  const db = await getDb();
  return all(db, `
    SELECT u.id, u.type, u.name, u.phone, u.created_at, sub.paid_until
    FROM users u LEFT JOIN subscriptions sub ON sub.user_id = u.id
    WHERE u.type IN ('salon', 'artist') AND u.suspended_at IS NULL
    ORDER BY u.id
  `);
}

/** Claims one reminder for one end date. True only for the first caller, so overlapping sweeps never send twice. */
export async function claimNotice(userId, kind, periodEnd) {
  const db = await getDb();
  const row = await get(db, `
    INSERT INTO billing_notices (user_id, kind, period_end) VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING RETURNING user_id
  `, [Number(userId), String(kind), periodEnd]);
  return Boolean(row);
}

export { accessOf, salonCover };

/* ───────────────────────── admin ───────────────────────── */

const STATUSES = ["pending", "paid", "failed"];

/** The ledger for the admin, newest first. Filters: status, source (gateway / admin), text (name, phone, receipt, tracking code). */
export async function listPayments({ status = "", source = "", q = "", userId = null, offset = 0, limit = 30 } = {}) {
  await ensureBillingTables();
  const db = await getDb();
  const where = [];
  const params = [];
  if (STATUSES.includes(status)) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (source === "gateway" || source === "admin") {
    params.push(source);
    where.push(`source = $${params.length}`);
  }
  if (userId) {
    params.push(Number(userId));
    where.push(`user_id = $${params.length}`);
  }
  const text = String(q || "").trim().slice(0, 60);
  if (text) {
    params.push(`%${text.replace(/[%_\\]/g, "\\$&")}%`);
    where.push(`(user_name ILIKE $${params.length} OR user_phone ILIKE $${params.length} OR receipt_no ILIKE $${params.length} OR ref_id ILIKE $${params.length})`);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const size = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const from = Math.max(Number(offset) || 0, 0);
  const [rows, total, counts] = await Promise.all([
    all(db, `SELECT * FROM payments ${clause} ORDER BY id DESC LIMIT ${size} OFFSET ${from}`, params),
    get(db, `SELECT COUNT(*)::int AS n FROM payments ${clause}`, params),
    all(db, "SELECT status, COUNT(*)::int AS n FROM payments GROUP BY status")
  ]);
  return { rows, total: total?.n || 0, counts: Object.fromEntries(counts.map((row) => [row.status, row.n])) };
}

/**
 * Money and accounts at a glance. Revenue counts real money only: paid rows that are not from the test gateway
 * (admin-recorded payments with an amount are real money taken outside the app, so they count).
 */
export async function billingStats(now = new Date()) {
  await ensureBillingTables();
  const db = await getDb();
  const settings = await getBillingSettings();
  const [money, accounts] = await Promise.all([
    get(db, `
      SELECT
        COALESCE(SUM(amount_rial) FILTER (WHERE paid_at >= $1::timestamptz - INTERVAL '1 day'), 0)::bigint AS day_rial,
        COALESCE(SUM(amount_rial) FILTER (WHERE paid_at >= $1::timestamptz - INTERVAL '30 days'), 0)::bigint AS month_rial,
        COALESCE(SUM(amount_rial), 0)::bigint AS all_rial,
        COUNT(*) FILTER (WHERE paid_at >= $1::timestamptz - INTERVAL '1 day' AND amount_rial > 0)::int AS day_count,
        COUNT(*) FILTER (WHERE paid_at >= $1::timestamptz - INTERVAL '30 days' AND amount_rial > 0)::int AS month_count
      FROM payments WHERE status = 'paid' AND gateway <> 'sandbox'
    `, [now]),
    listBilledAccounts()
  ]);
  const states = { trial: 0, active: 0, grace: 0, expired: 0 };
  const closedArtists = [];
  for (const row of accounts) {
    const { state } = accessOf(row, row.paid_until, settings, now);
    states[state] += 1;
    if (state === "expired" && row.type === "artist") closedArtists.push(row.id);
  }
  const covered = (await salonCover(db, closedArtists, settings, now)).size;
  const pending = await get(db, "SELECT COUNT(*)::int AS n FROM payments WHERE status = 'pending' AND authority IS NOT NULL AND created_at <= $1::timestamptz - INTERVAL '10 minutes' AND created_at >= $1::timestamptz - INTERVAL '3 days'", [now]);
  const toToman = (rial) => rialToToman(Number(rial || 0));
  return {
    revenue: {
      dayToman: toToman(money?.day_rial),
      monthToman: toToman(money?.month_rial),
      allToman: toToman(money?.all_rial),
      dayCount: money?.day_count || 0,
      monthCount: money?.month_count || 0
    },
    accounts: { ...states, coveredBySalon: covered, total: accounts.length },
    stuckPending: pending?.n || 0
  };
}

/** Paid checkouts in the last 24 hours: the badge on the admin rail. */
export async function countRecentPaid() {
  await ensureBillingTables();
  const db = await getDb();
  const row = await get(db, "SELECT COUNT(*)::int AS n FROM payments WHERE status = 'paid' AND source = 'gateway' AND paid_at >= NOW() - INTERVAL '1 day'");
  return row?.n || 0;
}
