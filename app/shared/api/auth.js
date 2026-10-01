import { apiFetch, apiJson } from "./client";

/**
 * GET /api/auth/me
 * - logged in → { data: { user }, profile }  (both = publicUser)
 * - guest → { data: { user: null } }  (no top-level profile)
 */
export async function getAuthMe() {
  return apiJson("/api/auth/me");
}

/**
 * POST /api/auth/login  body: { phone, password }
 * → 200 { data: { user }, profile } + Set-Cookie session
 * → 401 { error, code: "not_found" | "bad_password" }
 */
export async function login(body) {
  return apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/**
 * POST /api/auth/register
 * body: { phone, password, type: "client"|"artist"|"salon", data?: { name, area, service, email, avatar, bio } }
 * → 200/201 { data: { user }, profile } + Set-Cookie
 * → 400 / 409
 * Salon register also ensureSalonHours on the server.
 */
export async function register(body) {
  return apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/** POST /api/auth/logout → { data: { ok: true } } + clear cookie */
export async function logout() {
  return apiFetch("/api/auth/logout", { method: "POST" });
}

/** DELETE /api/profile  body: { currentPassword }
 *  → 200 { profile: null, data: { user: null } } + clear cookie
 *  → 400 { error } if currentPassword is missing/wrong (re-auth required,
 *     same bar as the password-change branch of POST /api/profile, so a
 *     hijacked session cookie alone can't destroy the account).
 *  Permanent — see migration v34 for what happens to other users' data that
 *  referenced this account (preserved, not cascade-deleted). */
export async function deleteAccount(currentPassword) {
  return apiFetch("/api/profile", {
    method: "DELETE",
    body: JSON.stringify({ currentPassword })
  });
}
