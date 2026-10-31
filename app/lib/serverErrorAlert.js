import { checkRateLimit } from "./rateLimit.js";
import { pushAdmins } from "./adminPush.js";

/**
 * Tells the operator's «فرفرو مدیر» app that a route crashed with an unexpected error (http.js withErrorHandling).
 * At most one push every 10 minutes, so a burst of crashes costs one push; the log has every one of them.
 * Fire-and-forget: never throws and never delays the response. Admins without the app get nothing for now:
 * the SMS fallback needs its own pattern from Faraz, which is not approved yet.
 */

const QUIET_MS = 10 * 60 * 1000;

export function alertAdminsServerError() {
  void (async () => {
    if (!(await checkRateLimit("admin-push:server-error", 1, QUIET_MS)).ok) return;
    await pushAdmins({ title: "خطای سرور فرفرو", body: "یه خطای جدی تو سایت افتاد. لاگ سرور رو نگاه کن." });
  })().catch(() => {});
}
