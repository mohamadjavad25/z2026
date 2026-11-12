import { ensureDb } from "../../../lib/db/connection.js";
import { error, json, readJson, withErrorHandling } from "../../../lib/http.js";
import { checkIpRateLimit } from "../../../lib/rateLimit.js";
import { optOut } from "../../../lib/contactRequests.js";

export const runtime = "nodejs";

// POST { code }: «دیگه پیام نده» on the link page. No account needed: the code came in the SMS to that number.
async function _POST(request) {
  await ensureDb();
  const limited = await checkIpRateLimit(request, "contact-opt-out", 30, 60 * 60 * 1000);
  if (!limited.ok) return json({ error: "زیاد امتحان کردی؛ یه کم دیگه دوباره بزن." }, { status: 429 });
  const done = await optOut(String((await readJson(request))?.code || ""));
  if (!done) return error("این لینک دیگه کار نمی‌کنه.", 404);
  return json({ data: { ok: true } });
}

export const POST = withErrorHandling(_POST);
