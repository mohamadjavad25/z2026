import { checkRateLimit } from "./rateLimit.js";
import { pushAdmins } from "./adminPush.js";
import { isRetryableConnectError } from "./db/connection.js";

/**
 * Tells the operator's «فرفرو مدیر» app that a route crashed with an unexpected error (http.js withErrorHandling).
 * At most one push every 10 minutes, so a burst of crashes costs one push; the log has every one of them.
 * Fire-and-forget: never throws and never delays the response. Admins without the app get nothing for now:
 * the SMS fallback needs its own pattern from Faraz, which is not approved yet.
 *
 * It must still work when the database is the thing that is down (HEALTH debt 11, 2026-11-08): the 10-minute
 * quiet time is kept in this process's memory first and in the database only when it answers, and pushAdmins
 * falls back to the last admin apps it knew.
 */

const QUIET_MS = 10 * 60 * 1000;
let lastSentAt = 0;

function databaseLooksDown(error) {
  if (!error) return false;
  return isRetryableConnectError(error) || /timeout exceeded when trying to connect|statement timeout/i.test(String(error.message || ""));
}

export function alertAdminsServerError(error) {
  void (async () => {
    const now = Date.now();
    if (now - lastSentAt < QUIET_MS) return;
    lastSentAt = now;
    // Other server processes share the quiet time through the database, when it answers.
    const shared = await checkRateLimit("admin-push:server-error", 1, QUIET_MS).catch(() => ({ ok: true }));
    if (!shared.ok) return;
    const dbDown = databaseLooksDown(error);
    await pushAdmins({
      title: dbDown ? "دیتابیس فرفرو جواب نمی‌ده" : "خطای سرور فرفرو",
      body: dbDown ? "کاربرها الان صفحهٔ خطا می‌بینن. سرور و دیتابیس رو نگاه کن." : "یه خطای جدی تو سایت افتاد. لاگ سرور رو نگاه کن.",
      tag: "server-error"
    });
  })().catch(() => {});
}
