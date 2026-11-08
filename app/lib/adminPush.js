import * as adminPush from "./db/repos/adminPush.js";
import { adminPhoneList } from "./admin.js";
import { fcmConfigured, fcmThrowReason, sendFcm } from "./fcm.js";
import { logger } from "./logger.js";

/**
 * News for the operator in the private «فرفرو مدیر» Android app (mobile/: the "admin" flavor, opens /admin).
 * Only accounts still listed in FRFRO_ADMIN_PHONES get it, so removing a phone there also stops its pushes.
 * Returns the phones it reached, so the caller texts only the other admins (adminSms.js, billing/service.js).
 * A `tag` replaces the earlier notification with the same tag on the phone (fcm.js). Never throws.
 * Every call writes one «push.admin» log line (how many apps Google took, and why the others failed), so
 * «I got no notice» can be answered from the server log (journalctl -u frfro | grep push.admin).
 */
let knownTokens = [];

/** Keeps the in-memory list fresh for the moment the database is down (run by the 5-minute server watch). Never throws. */
export async function rememberAdminTokens() {
  if (!fcmConfigured()) return;
  knownTokens = await adminPush.listFreshTokensForPhones(adminPhoneList()).catch(() => knownTokens);
}

export async function pushAdmins({ title, body, url = "/admin", tag = "" } = {}) {
  const reached = new Set();
  if (!fcmConfigured()) {
    logger.warn("push.admin", { tag, apps: 0, accepted: 0, failures: ["fcm off"] });
    return reached;
  }
  // The last list that came back is kept in memory, so the alert «دیتابیس جواب نمی‌ده» still reaches the admin app
  // while the database is the thing that is down (serverErrorAlert.js).
  let tokens;
  try {
    tokens = await adminPush.listFreshTokensForPhones(adminPhoneList());
    knownTokens = tokens;
  } catch {
    tokens = knownTokens;
  }
  const failures = [];
  await Promise.all(tokens.map(async (row) => {
    const result = await sendFcm(row.token, { title, body, url, tag }).catch((error) => ({ ok: false, gone: false, reason: fcmThrowReason(error) }));
    if (result.ok) reached.add(row.phone);
    else {
      failures.push(result.reason || "failed");
      if (result.gone) {
        knownTokens = knownTokens.filter((item) => item.id !== row.id);
        await adminPush.removeTokenById(row.id).catch(() => {});
      }
    }
  }));
  const accepted = tokens.length - failures.length;
  logger[accepted ? "info" : "warn"]("push.admin", { tag, apps: tokens.length, accepted, ...(failures.length ? { failures } : {}) });
  return reached;
}
