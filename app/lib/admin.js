import { NextResponse } from "next/server";
import { verifyAdminToken, normalizePhone } from "./auth.js";
import { getAdminFromRequest, sameOrigin } from "./adminAuth.js";

/** Admins are ordinary accounts whose phone number is listed in ZIBABAN_ADMIN_PHONES (comma separated).
 *  Being listed is necessary but not enough: they also need a live admin session (see adminAuth.js: password + authenticator code).
 *  Remove the phone from the env var and the access is gone, even for an already-open session. */
function adminPhones() {
  return String(process.env.ZIBABAN_ADMIN_PHONES || "")
    .split(/[,\s]+/)
    .map((phone) => normalizePhone(phone))
    .filter(Boolean);
}

/** The normalized phones listed in ZIBABAN_ADMIN_PHONES. */
export const adminPhoneList = () => adminPhones();

export function isAdminPhone(phone) {
  const normalized = normalizePhone(phone);
  return Boolean(normalized) && adminPhones().includes(normalized);
}

/**
 * Gate for every /api/admin/* route. Accepts a live admin session (cookie from /api/admin/auth/login) or the legacy
 * `x-admin-token` header (kept so the existing password-reset API and scripts keep working; unset = disabled).
 * A normal user login is NOT enough any more.
 * Returns { ok: true, admin: { id, label } } or { ok: false }.
 */
export async function requireAdmin(request) {
  if (!sameOrigin(request)) return { ok: false };
  const admin = await getAdminFromRequest(request);
  if (admin) return { ok: true, admin: { id: admin.id, label: admin.phone, stepUp: admin.stepUp } };
  if (verifyAdminToken(request)) return { ok: true, admin: { id: null, label: "token" } };
  return { ok: false };
}

/**
 * Extra gate for dangerous actions (deleting accounts/posts, ...): the admin must have re-typed their password in the last
 * 5 minutes (POST /api/admin/auth/stepup). Returns a ready 403 response when they have not, or null when all is well.
 * The legacy token path never passes: it is not tied to a person who can re-authenticate.
 */
export function requireStepUp(gate) {
  if (gate.admin?.stepUp) return null;
  return NextResponse.json({ error: "برای این کار رمز عبورت را دوباره وارد کن.", code: "stepup_required" }, { status: 403, headers: { "Cache-Control": "no-store" } });
}
