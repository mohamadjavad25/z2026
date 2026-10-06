import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { getDb, get, run } from "./db/connection.js";
import * as users from "./db/repos/users.js";
import * as adminRepo from "./db/repos/admin.js";
import { DUMMY_PASSWORD_HASH, normalizeDigits, normalizePhone, verifyPassword } from "./auth.js";
import { checkRateLimit } from "./rateLimit.js";
import { isAdminPhone } from "./admin.js";
import { generateTotpSecret, totpUri, verifyTotp } from "./totp.js";

/**
 * Hardened admin login. Everything here is separate from the normal user login:
 *   1. the phone must be in ZIBABAN_ADMIN_PHONES,
 *   2. the account password must be right,
 *   3. a fresh 6-digit code from the admin's authenticator app must be right (each code works once),
 * and the result is a dedicated admin session (own cookie, 30 min idle / 8 h absolute, bound to the browser, SameSite=Strict).
 * The first-time authenticator setup additionally needs ZIBABAN_ADMIN_SETUP_KEY, so knowing a password alone can never enroll anyone.
 * Every failure looks identical to the caller; the real reason goes only to the audit log.
 */
export const ADMIN_COOKIE = process.env.NODE_ENV === "production" ? "__Host-zibaban_admin" : "zibaban_admin";
const IDLE_MS = 30 * 60 * 1000;
const ABSOLUTE_MS = 8 * 60 * 60 * 1000;
const TOUCH_EVERY_MS = 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

export const GENERIC_FAILURE = "اطلاعات ورود درست نیست.";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function adminSecret() {
  const value = process.env.ZIBABAN_ADMIN_SECRET || "";
  return value.length >= 32 ? value : "";
}

/** False until ZIBABAN_ADMIN_SECRET (32+ random characters) is set: the admin login then refuses everything (fails closed). */
export const adminAuthConfigured = () => Boolean(adminSecret());

function encryptionKey() {
  return createHash("sha256").update(`zibaban-admin-totp|${adminSecret()}`).digest();
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

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return (forwarded.split(",")[0] || request.headers.get("x-real-ip") || "unknown").trim().slice(0, 64);
}

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

async function audit(action, { user = null, phone = "", detail = "", request }) {
  try {
    await adminRepo.logAction({
      adminUserId: user?.id ?? null,
      adminLabel: phone || user?.phone || "",
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

/** Phone + password check that costs the same whatever is wrong, and only ever passes for listed, active admins. */
async function checkCredentials(phoneInput, passwordInput) {
  const phone = normalizePhone(phoneInput);
  const password = normalizeDigits(String(passwordInput || ""));
  const user = phone ? await users.getUserByPhone(phone) : null;
  const passwordOk = verifyPassword(password, user?.password_hash || DUMMY_PASSWORD_HASH);
  if (!user || !passwordOk || user.suspended_at || !isAdminPhone(user.phone)) return { ok: false, phone, user };
  return { ok: true, phone, user };
}

async function createAdminSession(userId, request) {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  const expiresAt = now + ABSOLUTE_MS;
  const db = await getDb();
  await run(db, "DELETE FROM admin_sessions WHERE expires_at < NOW() OR user_id = $1", [userId]); // one live session per admin
  await run(db, "INSERT INTO admin_sessions (token_hash, user_id, ua_hash, expires_at) VALUES ($1, $2, $3, $4)", [sha256(token), userId, userAgentHash(request), new Date(expiresAt).toISOString()]);
  return { token, expiresAt };
}

export async function destroyAdminSession(request) {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return;
  const db = await getDb();
  await run(db, "DELETE FROM admin_sessions WHERE token_hash = $1", [sha256(token)]);
}

/** Resolves the admin session cookie to { id, phone, name } or null. Enforces idle/absolute expiry, browser binding, and that the phone is still listed. */
export async function getAdminFromRequest(request) {
  if (!adminAuthConfigured()) return null;
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const hash = sha256(token);
  const row = await get(db, `
    SELECT s.user_id, s.ua_hash, s.last_seen_at, s.expires_at, u.phone, u.name, u.suspended_at
    FROM admin_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.expires_at > NOW()
  `, [hash]);
  const now = Date.now();
  const idleOk = row && now - new Date(row.last_seen_at).getTime() < IDLE_MS;
  if (!row || !idleOk || row.suspended_at || !isAdminPhone(row.phone) || row.ua_hash !== userAgentHash(request)) {
    if (row) await run(db, "DELETE FROM admin_sessions WHERE token_hash = $1", [hash]);
    return null;
  }
  if (now - new Date(row.last_seen_at).getTime() > TOUCH_EVERY_MS) await run(db, "UPDATE admin_sessions SET last_seen_at = NOW() WHERE token_hash = $1", [hash]);
  return { id: row.user_id, phone: row.phone, name: row.name || "" };
}

function failure(status = 401) {
  return { ok: false, status, error: status === 429 ? "تلاش‌های ورود زیاد بود. بعداً دوباره امتحان کن." : GENERIC_FAILURE };
}

/** Step 3 of the login: phone + password + current authenticator code. */
export async function adminLogin(request, { phone: phoneInput, password, code }) {
  const phone = normalizePhone(phoneInput);
  if (!adminAuthConfigured()) return failure();
  if (!(await allowed(request, phone, "login", 8, 20))) {
    await audit("login_blocked", { phone, detail: "rate limited", request });
    return failure(429);
  }
  const check = await checkCredentials(phone, password);
  const db = await getDb();
  const row = check.ok ? await get(db, "SELECT secret_enc, last_step FROM admin_totp WHERE user_id = $1 AND enabled_at IS NOT NULL", [check.user.id]) : null;
  const step = row ? verifyTotp(decryptSecret(row.secret_enc), normalizeDigits(String(code || "")), { afterStep: Number(row.last_step) }) : null;
  if (!check.ok || !row || step === null) {
    const reason = !check.ok ? "bad phone/password or not an admin" : !row ? "authenticator not set up" : "bad code";
    await audit("login_failed", { phone, detail: reason, request });
    return failure();
  }
  // Atomic: only the request that moves last_step forward wins, so one code can never be accepted twice in parallel.
  const claimed = await get(db, "UPDATE admin_totp SET last_step = $2 WHERE user_id = $1 AND last_step < $2 RETURNING user_id", [check.user.id, step]);
  if (!claimed) {
    await audit("login_failed", { phone, detail: "code reused", request });
    return failure();
  }
  const session = await createAdminSession(check.user.id, request);
  await audit("login", { user: check.user, request });
  return { ok: true, session };
}

/** First-time setup, part 1: proves password + setup key, then hands out a fresh authenticator secret (QR + manual key). */
export async function adminEnrollStart(request, { phone: phoneInput, password, setupKey }) {
  const phone = normalizePhone(phoneInput);
  const expected = process.env.ZIBABAN_ADMIN_SETUP_KEY || "";
  if (!adminAuthConfigured() || expected.length < 16) return failure();
  if (!(await allowed(request, phone, "enroll", 10, 15))) return failure(429);
  const check = await checkCredentials(phone, password);
  const keyOk = safeEqual(sha256(String(setupKey || "")), sha256(expected));
  const db = await getDb();
  const existing = check.ok ? await get(db, "SELECT enabled_at FROM admin_totp WHERE user_id = $1", [check.user.id]) : null;
  if (!check.ok || !keyOk || existing?.enabled_at) {
    await audit("enroll_failed", { phone, detail: !check.ok ? "bad phone/password or not an admin" : !keyOk ? "bad setup key" : "already enrolled", request });
    return failure();
  }
  const secret = generateTotpSecret();
  await run(db, `
    INSERT INTO admin_totp (user_id, secret_enc) VALUES ($1, $2)
    ON CONFLICT (user_id) DO UPDATE SET secret_enc = EXCLUDED.secret_enc, last_step = 0, created_at = NOW()
  `, [check.user.id, encryptSecret(secret)]);
  const uri = totpUri({ secret, account: check.user.phone });
  return { ok: true, secret, uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 240 }) };
}

/** First-time setup, part 2: the admin types the first code from the app; if right, the authenticator is switched on and they are logged in. */
export async function adminEnrollConfirm(request, { phone: phoneInput, password, setupKey, code }) {
  const phone = normalizePhone(phoneInput);
  const expected = process.env.ZIBABAN_ADMIN_SETUP_KEY || "";
  if (!adminAuthConfigured() || expected.length < 16) return failure();
  if (!(await allowed(request, phone, "enroll", 10, 15))) return failure(429);
  const check = await checkCredentials(phone, password);
  const keyOk = safeEqual(sha256(String(setupKey || "")), sha256(expected));
  const db = await getDb();
  const row = check.ok && keyOk ? await get(db, "SELECT secret_enc, enabled_at FROM admin_totp WHERE user_id = $1", [check.user.id]) : null;
  const step = row && !row.enabled_at ? verifyTotp(decryptSecret(row.secret_enc), normalizeDigits(String(code || ""))) : null;
  if (step === null) {
    await audit("enroll_failed", { phone, detail: "confirm failed", request });
    return failure();
  }
  const enabled = await get(db, "UPDATE admin_totp SET enabled_at = NOW(), last_step = $2 WHERE user_id = $1 AND enabled_at IS NULL RETURNING user_id", [check.user.id, step]);
  if (!enabled) return failure();
  const session = await createAdminSession(check.user.id, request);
  await audit("enroll", { user: check.user, request });
  return { ok: true, session };
}
