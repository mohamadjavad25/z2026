import { ensureDb } from "../../../lib/db/connection.js";
import { json, requireUser, withErrorHandling } from "../../../lib/http.js";
import { sendPushToUser } from "../../../lib/push.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";

export const runtime = "nodejs";

/** «یه اعلان آزمایشی بفرست» in Settings: one push to the person's own phones, so they can see it works. A few a minute at most. */
async function _POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const limited = await checkRateLimit(`push-test:${auth.user.id}`, 3, 60 * 1000);
  if (!limited.ok) return json({ error: "چند لحظه صبر کن و دوباره بزن." }, { status: 429 });

  const result = await sendPushToUser(auth.user.id, {
    title: "فرفرو",
    body: "اعلان‌هات درست کار می‌کنه.",
    url: "/",
    ttl: 120
  });
  return json({ data: { sent: Number(result.sent || 0) } });
}

export const POST = withErrorHandling(_POST);
