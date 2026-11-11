import { normalizePhone } from "../shared/lib/phone.js";

/** Admins are the phone numbers listed in FRFRO_ADMIN_PHONES (comma separated), each with its own admin account
 *  (admin_accounts, apart from the app's users). Being listed is necessary but not enough: they also need a live
 *  admin session (see adminAuth.js: admin password + authenticator code). `admin.id` is the admin account's id, never a user id.
 *  Remove the phone from the env var and the access is gone, even for an already-open session. */
function adminPhones() {
  return String(process.env.FRFRO_ADMIN_PHONES || "")
    .split(/[,\s]+/)
    .map((phone) => normalizePhone(phone))
    .filter(Boolean);
}

/** The normalized phones listed in FRFRO_ADMIN_PHONES. */
export const adminPhoneList = () => adminPhones();

export function isAdminPhone(phone) {
  const normalized = normalizePhone(phone);
  return Boolean(normalized) && adminPhones().includes(normalized);
}
