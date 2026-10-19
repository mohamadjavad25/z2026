import * as adminPush from "./db/repos/adminPush.js";
import { adminPhoneList } from "./admin.js";
import { fcmConfigured, sendFcm } from "./fcm.js";

/**
 * News for the operator in the private «فرفرو مدیر» Android app (mobile/: the "admin" flavor, opens /admin).
 * Only accounts still listed in FRFRO_ADMIN_PHONES get it, so removing a phone there also stops its pushes.
 * Returns the phones it reached, so the caller texts only the other admins (adminSms.js, billing/service.js).
 * Never throws.
 */
export async function pushAdmins({ title, body, url = "/admin" } = {}) {
  const reached = new Set();
  if (!fcmConfigured()) return reached;
  const tokens = await adminPush.listFreshTokensForPhones(adminPhoneList()).catch(() => []);
  await Promise.all(tokens.map(async (row) => {
    const result = await sendFcm(row.token, { title, body, url }).catch(() => ({ ok: false, gone: false }));
    if (result.ok) reached.add(row.phone);
    else if (result.gone) await adminPush.removeTokenById(row.id).catch(() => {});
  }));
  return reached;
}
