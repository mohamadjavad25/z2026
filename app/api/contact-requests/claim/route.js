import { ensureDb } from "../../../lib/db/connection.js";
import { error, json, readJson, requireUser, withErrorHandling } from "../../../lib/http.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";
import { deliverByCode } from "../../../lib/contactRequests.js";

export const runtime = "nodejs";

// POST { code } -> { count }: a salon or artist who came from the SMS link (frfro.ir/r/<code>) takes the requests
// waiting for that number, also when the account's own number is another one. The code is the proof of the SMS.
async function _POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (auth.user.type !== "salon" && auth.user.type !== "artist") return error("این درخواست‌ها مال سالن یا آرتیسته.", 403);
  const limited = await checkRateLimit(`contact-claim:${auth.user.id}`, 10, 60 * 60 * 1000);
  if (!limited.ok) return json({ error: "زیاد امتحان کردی؛ یه کم دیگه دوباره بزن." }, { status: 429 });
  const result = await deliverByCode(auth.user, String((await readJson(request))?.code || ""));
  if (!result.ok) return error("این لینک دیگه کار نمی‌کنه.", 404);
  return json({ data: { count: result.count } });
}

export const POST = withErrorHandling(_POST);
