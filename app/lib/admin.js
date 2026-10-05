import { getUserFromRequest, verifyAdminToken, normalizePhone } from "./auth.js";

/** Admins are ordinary accounts whose phone number is listed in ZIBABAN_ADMIN_PHONES (comma separated).
 *  No separate admin login, no flag a bug could flip: remove the phone from the env var and the access is gone. */
function adminPhones() {
  return String(process.env.ZIBABAN_ADMIN_PHONES || "")
    .split(/[,\s]+/)
    .map((phone) => normalizePhone(phone))
    .filter(Boolean);
}

export function isAdminPhone(phone) {
  const normalized = normalizePhone(phone);
  return Boolean(normalized) && adminPhones().includes(normalized);
}

/**
 * Gate for every /api/admin/* route. Accepts either an admin's own session or the legacy
 * `x-admin-token` header (kept so the existing password-reset API and scripts keep working).
 * Returns { ok: true, admin: { id, label } } or { ok: false }.
 */
export async function requireAdmin(request) {
  const user = await getUserFromRequest(request);
  if (user && isAdminPhone(user.phone)) return { ok: true, admin: { id: user.id, label: user.phone } };
  if (verifyAdminToken(request)) return { ok: true, admin: { id: null, label: "token" } };
  return { ok: false };
}
