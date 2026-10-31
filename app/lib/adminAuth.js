import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { all, getDb, get, run } from "./db/connection.js";
import * as adminRepo from "./db/repos/admin.js";
import { DUMMY_PASSWORD_HASH, hashPassword, normalizeDigits, normalizePhone, verifyPassword } from "./auth.js";
import { checkRateLimit, clientIp } from "./rateLimit.js";
import { adminPhoneList, isAdminPhone } from "./admin.js";
import { generateTotpSecret, totpUri, verifyTotp } from "./totp.js";

/**
 * Hardened admin login, apart from the app's accounts (owner's decision 2026-10-27): an admin is a row in admin_accounts,
 * not a user. Whether an app account with the same phone exists, or gets deleted, changes nothing here.
 *   1. the phone must be in FRFRO_ADMIN_PHONES,
 *   2. the admin password (its own, not the app's) must be right,
 *   3. a fresh 6-digit code from the admin's authenticator app must be right (each code works once),
 * and the result is a dedicated admin session (own cookie, 30 min idle / 8 h absolute, bound to the browser, SameSite=Strict).
 * Setup (first time, or again after a lost password or phone) needs FRFRO_ADMIN_SETUP_KEY and sets both a new password and
 * a new authenticator; the old ones keep working until the first code of the new one is typed.
 * Every failure looks identical to the caller; the real reason goes only to the audit log.
 */
export const ADMIN_COOKIE = process.env.NODE_ENV === "production" ? "__Host-frfro_admin" : "frfro_admin";
const IDLE_MS = 30 * 60 * 1000;
const ABSOLUTE_MS = 8 * 60 * 60 * 1000;
const TOUCH_EVERY_MS = 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const SETUP_MS = 15 * 60 * 1000;
export const ADMIN_PASSWORD_MIN = 8;

export const GENERIC_FAILURE = "اطلاعات ورود درست نیست.";

let tablesReady;
/** Creates the admin tables on first use (same DDL as migrations/057_admin_accounts.sql, idempotent), so no manual database step is needed. */
function ensureAdminTables() {
  tablesReady ??= (async () => {
    const db = await getDb();
    await run(db, `CREATE TABLE IF NOT EXISTS admin_accounts (
      id SERIAL PRIMARY KEY,
      phone TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      totp_secret_enc TEXT,
      totp_enabled_at TIMESTAMPTZ,
      totp_last_step BIGINT NOT NULL DEFAULT 0,
      setup_secret_enc TEXT,
      setup_password_hash TEXT,
      setup_started_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await run(db, `CREATE TABLE IF NOT EXISTS admin_account_sessions (
      token_hash TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
      ua_hash TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      stepup_until TIMESTAMPTZ
    )`);
    await run(db, "CREATE INDEX IF NOT EXISTS idx_admin_account_sessions_admin ON admin_account_sessions (admin_id)");
  })().catch((error) => {
    tablesReady = undefined; // retry on the next request instead of caching a failure
    throw error;
  });
  return tablesReady;
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function adminSecret() {
  const value = process.env.FRFRO_ADMIN_SECRET || "";
  return value.length >= 32 ? value : "";
}

/** Whether setup can work at all: FRFRO_ADMIN_SETUP_KEY must be set on the server and 16+ characters (the value itself is never exposed). */
export const setupKeyConfigured = () => (process.env.FRFRO_ADMIN_SETUP_KEY || "").length >= 16;

/** False until FRFRO_ADMIN_SECRET (32+ random characters) is set: the admin login then refuses everything (fails closed). */
export const adminAuthConfigured = () => Boolean(adminSecret());

function encryptionKey() {
  return createHash("sha256").update(`frfro-admin-totp|${adminSecret()}`).digest();
}

function encryptSecret(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".");
}

function decryptSecret(stored) {
  const [iv, tag, data] = String(stored).split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Reads a stored authenticator secret, or null when it cannot be decrypted (e.g. FRFRO_ADMIN_SECRET was changed since it was saved). */
function tryDecryptSecret(stored) {
  if (!stored) return null;
  try {
    return decryptSecret(stored);
  } catch {
    return null;
  }
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

export { clientIp };

const userAgentHash = (request) => sha256(request.headers.get("user-agent") || "");

/** Same-origin check for state-changing admin requests, on top of SameSite=Strict. */
export function sameOrigin(request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser callers (tests, curl) send none; browsers always do on POST
  try {
    return new URL(origin).host === (request.headers.get("host") || "");
  } catch {
    return false;
  }
}

export function setAdminCookie(response, token, expiresAt) {
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(expiresAt)
  });
}

export function clearAdminCookie(response) {
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", secure: process.env.NODE_ENV === "production", expires: new Date(0) });
}

/** admin_actions.admin_user_id points at users, so admin events carry only the phone (admin_label). */
async function audit(action, { phone = "", detail = "", request }) {
  try {
    await adminRepo.logAction({
      adminLabel: phone,
      action,
      detail: `${detail}${request ? ` ip=${clientIp(request)}` : ""}`.trim()
    });
  } catch {
    // auditing must never break the login path
  }
}

/** Per-IP and per-phone throttles. Returns true when the attempt may go on. */
async function allowed(request, phone, scope, perPhone, perIp) {
  const ip = await checkRateLimit(`admin-${scope}-ip:${clientIp(request)}`, perIp, WINDOW_MS);
  if (!ip.ok) return false;
  if (!phone) return true;
  return (await checkRateLimit(`admin-${scope}:${phone}`, perPhone, WINDOW_MS)).ok;
}

async function accountByPhone(phone) {
  if (!phone) return null;
  const db = await getDb();
  return get(db, "SELECT * FROM admin_accounts WHERE phone = $1", [phone]);
}

/** Phone + admin password check that costs the same whatever is wrong, and only ever passes for listed admins. */
async function checkCredentials(phoneInput, passwordInput) {
  const phone = normalizePhone(phoneInput);
  const password = normalizeDigits(String(passwordInput || ""));
  const account = await accountByPhone(phone);
  const passwordOk = await verifyPassword(password, account?.password_hash || DUMMY_PASSWORD_HASH);
  if (!account || !passwordOk || !isAdminPhone(account.phone)) return { ok: false, phone, account };
  return { ok: true, phone, account };
}

async function createAdminSession(adminId, request) {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  const expiresAt = now + ABSOLUTE_MS;
  const db = await getDb();
  await run(db, "DELETE FROM admin_account_sessions WHERE expires_at < NOW() OR admin_id = $1", [adminId]); // one live session per admin
  await run(db, "INSERT INTO admin_account_sessions (token_hash, admin_id, ua_hash, expires_at) VALUES ($1, $2, $3, $4)", [sha256(token), adminId, userAgentHash(request), new Date(expiresAt).toISOString()]);
  return { token, expiresAt };
}

export async function destroyAdminSession(request) {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return;
  await ensureAdminTables();
  const db = await getDb();
  await run(db, "DELETE FROM admin_account_sessions WHERE token_hash = $1", [sha256(token)]);
}

/** Resolves the admin session cookie to { id, phone, name } or null. Enforces idle/absolute expiry, browser binding, and that the phone is still listed. */
export async function getAdminFromRequest(request) {
  if (!adminAuthConfigured()) return null;
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  await ensureAdminTables();
  const db = await getDb();
  const hash = sha256(token);
  const row = await get(db, `
    SELECT s.admin_id, s.ua_hash, s.last_seen_at, s.expires_at, s.stepup_until, a.phone
    FROM admin_account_sessions s JOIN admin_accounts a ON a.id = s.admin_id
    WHERE s.token_hash = $1 AND s.expires_at > NOW()
  `, [hash]);
  const now = Date.now();
  const idleOk = row && now - new Date(row.last_seen_at).getTime() < IDLE_MS;
  if (!row || !idleOk || !isAdminPhone(row.phone) || row.ua_hash !== userAgentHash(request)) {
    if (row) await run(db, "DELETE FROM admin_account_sessions WHERE token_hash = $1", [hash]);
    return null;
  }
  if (now - new Date(row.last_seen_at).getTime() > TOUCH_EVERY_MS) await run(db, "UPDATE admin_account_sessions SET last_seen_at = NOW() WHERE token_hash = $1", [hash]);
  return { id: row.admin_id, phone: row.phone, name: "", stepUp: Boolean(row.stepup_until && new Date(row.stepup_until).getTime() > now) };
}

const STEPUP_MS = 5 * 60 * 1000;

/** Re-checks the admin password; on success the session may run dangerous actions for 5 minutes. */
export async function adminStepUp(request, admin, password) {
  await ensureAdminTables();
  if (!(await allowed(request, admin.phone, "stepup", 6, 15))) return { ok: false, status: 429 };
  const check = await checkCredentials(admin.phone, password);
  if (!check.ok || check.account.id !== admin.id) {
    await audit("stepup_failed", { phone: admin.phone, request });
    return { ok: false, status: 401 };
  }
  const token = request.cookies.get(ADMIN_COOKIE)?.value || "";
  const db = await getDb();
  await run(db, "UPDATE admin_account_sessions SET stepup_until = $2 WHERE token_hash = $1", [sha256(token), new Date(Date.now() + STEPUP_MS).toISOString()]);
  await audit("stepup", { phone: admin.phone, request });
  return { ok: true };
}

/** Admin sessions that are still alive, for the security tab. Never returns tokens. */
export async function listAdminSessions() {
  await ensureAdminTables();
  const db = await getDb();
  return all(db, `
    SELECT s.admin_id, a.phone, s.created_at, s.last_seen_at, s.expires_at
    FROM admin_account_sessions s JOIN admin_accounts a ON a.id = s.admin_id
    WHERE s.expires_at > NOW() ORDER BY s.last_seen_at DESC
  `);
}

/** Every phone listed in FRFRO_ADMIN_PHONES with its state: set up?, signed in right now? */
export async function listAdminAccounts() {
  await ensureAdminTables();
  const phones = adminPhoneList();
  if (!phones.length) return [];
  const db = await getDb();
  const rows = await all(db, `
    SELECT a.id, a.phone, a.totp_enabled_at,
           EXISTS (SELECT 1 FROM admin_account_sessions s WHERE s.admin_id = a.id AND s.expires_at > NOW()) AS online
    FROM admin_accounts a WHERE a.phone = ANY($1) ORDER BY a.id
  `, [phones]);
  const known = new Map(rows.map((row) => [row.phone, row]));
  return phones.map((phone) => {
    const row = known.get(phone);
    return { id: row?.id ?? null, phone, ready: Boolean(row?.totp_enabled_at), online: Boolean(row?.online) };
  });
}

/** Switches one admin's authenticator off and ends their sessions; they get back in only through setup (with the setup key). */
export async function resetAdminAuthenticator(adminId) {
  await ensureAdminTables();
  const db = await getDb();
  await run(db, "UPDATE admin_accounts SET totp_secret_enc = NULL, totp_enabled_at = NULL, setup_secret_enc = NULL, setup_password_hash = NULL, setup_started_at = NULL WHERE id = $1", [Number(adminId)]);
  await run(db, "DELETE FROM admin_account_sessions WHERE admin_id = $1", [Number(adminId)]);
}

/** Ends every live session of one admin (their next request lands on the login form). */
export async function revokeAdminSessions(adminId) {
  await ensureAdminTables();
  const db = await getDb();
  await run(db, "DELETE FROM admin_account_sessions WHERE admin_id = $1", [Number(adminId)]);
}

/** The admin account row of a listed phone, for the security tab's actions. */
export async function getAdminAccount(adminId) {
  await ensureAdminTables();
  const db = await getDb();
  return get(db, "SELECT id, phone FROM admin_accounts WHERE id = $1", [Number(adminId)]);
}

function failure(status = 401) {
  return { ok: false, status, error: status === 429 ? "تلاش‌های ورود زیاد بود. بعداً دوباره امتحان کن." : GENERIC_FAILURE };
}

/** Phone + admin password + current authenticator code. */
export async function adminLogin(request, { phone: phoneInput, password, code }) {
  const phone = normalizePhone(phoneInput);
  if (!adminAuthConfigured()) return failure();
  await ensureAdminTables();
  if (!(await allowed(request, phone, "login", 8, 20))) {
    await audit("login_blocked", { phone, detail: "rate limited", request });
    return failure(429);
  }
  const check = await checkCredentials(phone, password);
  const account = check.ok && check.account.totp_enabled_at ? check.account : null;
  const secret = account ? tryDecryptSecret(account.totp_secret_enc) : null;
  const step = secret ? verifyTotp(secret, normalizeDigits(String(code || "")), { afterStep: Number(account.totp_last_step) }) : null;
  if (!check.ok || !account || step === null) {
    const reason = !check.ok ? "bad phone/password or not an admin" : !account ? "authenticator not set up" : !secret ? "authenticator unreadable (admin secret changed), setup needed" : "bad code";
    await audit("login_failed", { phone, detail: reason, request });
    return failure();
  }
  // Atomic: only the request that moves totp_last_step forward wins, so one code can never be accepted twice in parallel.
  const db = await getDb();
  const claimed = await get(db, "UPDATE admin_accounts SET totp_last_step = $2 WHERE id = $1 AND totp_last_step < $2 RETURNING id", [account.id, step]);
  if (!claimed) {
    await audit("login_failed", { phone, detail: "code reused", request });
    return failure();
  }
  const session = await createAdminSession(account.id, request);
  await audit("login", { phone, request });
  return { ok: true, session };
}

/** Setup, part 1: a listed phone + the setup key + a new admin password; hands out a fresh authenticator secret (QR + manual key).
 *  Nothing changes for the admin yet: the current password and authenticator keep working until part 2 succeeds. */
export async function adminEnrollStart(request, { phone: phoneInput, password, setupKey }) {
  const phone = normalizePhone(phoneInput);
  const expected = process.env.FRFRO_ADMIN_SETUP_KEY || "";
  if (!adminAuthConfigured() || expected.length < 16) return failure();
  await ensureAdminTables();
  if (!(await allowed(request, phone, "enroll", 10, 15))) return failure(429);
  const newPassword = normalizeDigits(String(password || ""));
  const keyOk = safeEqual(sha256(String(setupKey || "")), sha256(expected));
  if (!keyOk || !isAdminPhone(phone)) {
    await audit("enroll_failed", { phone, detail: !keyOk ? "bad setup key" : "not an admin phone", request });
    return failure();
  }
  if (newPassword.length < ADMIN_PASSWORD_MIN) return { ok: false, status: 400, error: `رمز مدیر دست‌کم ${ADMIN_PASSWORD_MIN} حرف باشد.` };
  const secret = generateTotpSecret();
  const db = await getDb();
  await run(db, `
    INSERT INTO admin_accounts (phone, setup_secret_enc, setup_password_hash, setup_started_at) VALUES ($1, $2, $3, NOW())
    ON CONFLICT (phone) DO UPDATE SET setup_secret_enc = EXCLUDED.setup_secret_enc, setup_password_hash = EXCLUDED.setup_password_hash, setup_started_at = NOW()
  `, [phone, encryptSecret(secret), await hashPassword(newPassword)]);
  const uri = totpUri({ secret, account: phone });
  return { ok: true, secret, uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 240 }) };
}

/** Setup, part 2: the first code from the app. If right, the new password and authenticator replace the old ones,
 *  every other session of this admin ends, and this browser is signed in. */
export async function adminEnrollConfirm(request, { phone: phoneInput, password, setupKey, code }) {
  const phone = normalizePhone(phoneInput);
  const expected = process.env.FRFRO_ADMIN_SETUP_KEY || "";
  if (!adminAuthConfigured() || expected.length < 16) return failure();
  await ensureAdminTables();
  if (!(await allowed(request, phone, "enroll", 10, 15))) return failure(429);
  const keyOk = safeEqual(sha256(String(setupKey || "")), sha256(expected));
  const account = keyOk && isAdminPhone(phone) ? await accountByPhone(phone) : null;
  const fresh = account?.setup_started_at && Date.now() - new Date(account.setup_started_at).getTime() < SETUP_MS;
  const passwordOk = await verifyPassword(normalizeDigits(String(password || "")), (fresh && account.setup_password_hash) || DUMMY_PASSWORD_HASH);
  const secret = fresh && passwordOk ? tryDecryptSecret(account.setup_secret_enc) : null;
  const step = secret ? verifyTotp(secret, normalizeDigits(String(code || ""))) : null;
  if (step === null) {
    await audit("enroll_failed", { phone, detail: "confirm failed", request });
    return failure();
  }
  const db = await getDb();
  // Atomic: the pending setup is used once; a second confirm with the same code finds nothing to switch on.
  const enabled = await get(db, `
    UPDATE admin_accounts SET password_hash = setup_password_hash, totp_secret_enc = setup_secret_enc, totp_enabled_at = NOW(), totp_last_step = $2,
      setup_secret_enc = NULL, setup_password_hash = NULL, setup_started_at = NULL
    WHERE id = $1 AND setup_secret_enc = $3 RETURNING id
  `, [account.id, step, account.setup_secret_enc]);
  if (!enabled) return failure();
  const session = await createAdminSession(account.id, request);
  await audit("enroll", { phone, request });
  return { ok: true, session };
}
