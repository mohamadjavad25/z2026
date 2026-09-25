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
    avatar: row.avatar ? `/api/media/avatar/${row.id}` : "",
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

export function getUserFromRequest(request) {
  ensureDb();
  const token = getSessionToken(request);
  if (!token) return null;
  const session = sessions.getValidSession(token);
  if (!session) return null;
  return users.getUserById(session.user_id);
}

export function requireUser(request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return { ok: false, error: "unauthorized", user: null };
  }
  return { ok: true, user };
}

export function createSessionForUser(userId) {
  ensureDb();
  const token = randomBytes(32).toString("hex");
  // Epoch ms — comparable numerically; avoids ISO vs CURRENT_TIMESTAMP string mismatch.
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  sessions.createSession(token, userId, expiresAt);
  return { token, expiresAt };
}

export function destroySession(token) {
  if (!token) return;
  sessions.deleteSession(token);
}

export { users, sessions };
