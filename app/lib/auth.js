import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { ensureDb } from "./db/connection.js";
import * as users from "./db/repos/users.js";
import * as sessions from "./db/repos/sessions.js";

export const SESSION_COOKIE = "zibaban_session";
const SESSION_DAYS = 30;

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

// Converts Persian (۰-۹) and Arabic-Indic (٠-٩) digits to Latin digits.
// Phone numbers AND passwords need this: a Persian keyboard types numeral
// glyphs that are different unicode characters from "0-9", so without this,
// a password typed in Persian digits at signup silently fails to verify at
// a later login where the same digits happen to come in as Latin (or vice
// versa) — the two hashes never match even though the user typed "the same"
// password both times.
export function normalizeDigits(value) {
  return String(value || "")
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)));
}

export function normalizePhone(value) {
  return normalizeDigits(value)
    .trim()
    .replace(/[\s\-()]/g, "");
}

const IRAN_MOBILE_PATTERN = /^09\d{9}$/;

export function isValidIranMobile(value) {
  return IRAN_MOBILE_PATTERN.test(String(value || ""));
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(normalizeDigits(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !String(stored).includes(":")) return false;
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(normalizeDigits(password), salt, 64);
  const prev = Buffer.from(hash, "hex");
  if (prev.length !== next.length) return false;
  return timingSafeEqual(prev, next);
}

/**
 * Fixed dummy scrypt hash (salt:hash of an arbitrary, never-real password)
 * with the exact shape verifyPassword expects. Its only use is
 * app/api/auth/login/route.js's "phone not registered" branch: calling
 * verifyPassword(password, DUMMY_PASSWORD_HASH) there and discarding the
 * (always-false) result burns the same scryptSync cost a genuine "wrong
 * password" check pays, so the two cases take equal time. Without this,
 * "not found" returns instantly (no scrypt run at all) while "wrong
 * password" pays scrypt's cost -- a measurable timing side-channel an
 * attacker could use to enumerate registered phone numbers even if the
 * two response bodies were made identical. This intentionally does NOT
 * unify the response codes themselves (not_found vs bad_password) --
 * app/features/auth/useAuthSession.js relies on that distinction for a
 * real UX feature (auto-redirect to signup), and the DB-backed rate
 * limiter (app/lib/rateLimit.js) is the primary defense against
 * brute-force enumeration either way.
 */
export const DUMMY_PASSWORD_HASH =
  "129869637c2b150b07704aa06e1e0d47:8d39cd87a4ce6233ce8467ec5936e12554bc75103d0a0a28279f21d0b45ffd16865af8aa0721735e7d75f1c43abf75bc291c59c963ff531b8ac1a970723d600c";

/** Timing-safe check of a request header against an expected secret --
 *  same timingSafeEqual pattern as verifyPassword above, instead of a plain
 *  `===` that leaks how many leading bytes matched via response timing.
 *  Length-checked first since timingSafeEqual throws on a length mismatch
 *  rather than returning false. Returns false (never throws) if `expected`
 *  is unset, so a misconfigured deployment fails closed. */
function verifyHeaderSecret(request, headerName, expected) {
  if (!expected) return false;
  const provided = request.headers.get(headerName) || "";
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

/** Gates the manual password-reset admin queue. */
export function verifyAdminToken(request) {
  return verifyHeaderSecret(request, "x-admin-token", process.env.ZIBABAN_ADMIN_TOKEN || "");
}

/** Gates app/api/cron/* endpoints -- a scheduler (Supabase pg_cron via
 *  `net.http_post`, or any external scheduler) calls these with
 *  `Authorization: Bearer <CRON_SECRET>`. */
export function verifyCronSecret(request) {
  const auth = request.headers.get("authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const expected = process.env.CRON_SECRET || "";
  if (!expected) return false;
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    name: row.name || "",
    area: row.area || "",
    service: row.service || "",
    phone: row.phone || "",
    email: row.email || "",
    // Stream the real (often huge, base64-in-sqlite) image via the media
    // route instead of embedding it in this JSON payload — this response
    // rides along on every login and every silent /api/auth/me session
    // check, so an inline data URL here meant re-downloading the user's
    // full-size avatar on nearly every request. See app/lib/db/repos/posts.js
    // (mapPost) for the same fix applied to feed/portfolio images.
    //
    // ?v=<updated_at> makes the URL itself change whenever the row is
    // saved (avatar/poster re-upload, removal, or reposition) -- without
    // it the URL is identical before and after a change, so a browser
    // that already cached the old response for it (even briefly) keeps
    // showing the old image on refresh regardless of the media route's
    // own cache headers, since it never even asks again until that cache
    // entry expires on its own.
    avatar: row.avatar ? `/api/media/avatar/${row.id}?v=${encodeURIComponent(row.updated_at?.toISOString?.() || row.updated_at || "")}` : "",
    poster: row.poster ? `/api/media/poster/${row.id}?v=${encodeURIComponent(row.updated_at?.toISOString?.() || row.updated_at || "")}` : "",
    avatarPosition: row.avatar_position || "",
    posterPosition: row.poster_position || "",
    bio: row.bio || "",
    experienceYears: row.experience_years || "",
    managerName: row.manager_name || ""
  };
}

export function setSessionCookie(response, token, expiresAt) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(expiresAt)
  });
}

export function clearSessionCookie(response) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0)
  });
}

export function getSessionToken(request) {
  return request.cookies.get(SESSION_COOKIE)?.value || "";
}

export async function getUserFromRequest(request) {
  await ensureDb();
  const token = getSessionToken(request);
  if (!token) return null;
  const session = await sessions.getValidSession(token);
  if (!session) return null;
  return users.getUserById(session.user_id);
}

export async function requireUser(request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return { ok: false, error: "unauthorized", user: null };
  }
  return { ok: true, user };
}

export async function createSessionForUser(userId) {
  await ensureDb();
  const token = randomBytes(32).toString("hex");
  // Epoch ms — comparable numerically; avoids ISO vs CURRENT_TIMESTAMP string mismatch.
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await sessions.createSession(token, userId, expiresAt);
  return { token, expiresAt };
}

export async function destroySession(token) {
  if (!token) return;
  await sessions.deleteSession(token);
}

export { users, sessions };
