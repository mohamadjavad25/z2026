import { ensureDb } from "../../lib/db/connection.js";
import { error, json, parseId, readJson, requireUserRole, withErrorHandling } from "../../lib/http.js";
import { checkRateLimit } from "../../lib/rateLimit.js";
import * as requests from "../../lib/db/repos/contactRequests.js";
import { forClient, sendContactRequest } from "../../lib/contactRequests.js";

export const runtime = "nodejs";

// A client's requests to salons and artists not on frfro yet, picked from the phone's contacts (owner, 2026-11-12).
//   GET                         -> { requests }: waiting ones, and ones closed in the last two days
//   POST { phone, contactName, service, serviceEmoji, bookingDate, time }
//                               -> 201 { request, sms } | 200 { found: profile } (already on frfro: book there)
//   DELETE { id }               -> take a waiting request back, or hide a closed one
const MESSAGE = "این بخش مال مشتری‌هاست.";

async function _GET(request) {
  await ensureDb();
  const auth = await requireUserRole(request, "client", MESSAGE);
  if (!auth.ok) return auth.response;
  const rows = await requests.listClientRequests(auth.user.id);
  return json({ data: { requests: rows.map(forClient) } });
}

async function _POST(request) {
  await ensureDb();
  const auth = await requireUserRole(request, "client", MESSAGE);
  if (!auth.ok) return auth.response;
  // Against a script hammering numbers; the real caps (a day, open ones) are counted in the database.
  const limited = await checkRateLimit(`contact-request:${auth.user.id}`, 12, 60 * 60 * 1000);
  if (!limited.ok) return json({ error: "زیاد امتحان کردی؛ یه کم دیگه دوباره بزن.", code: "rate_limited" }, { status: 429 });
  const result = await sendContactRequest(auth.user, (await readJson(request)) || {});
  if (result.error) return json({ error: result.error, code: result.code }, { status: result.status });
  return json({ data: result.data }, { status: result.status });
}

async function _DELETE(request) {
  await ensureDb();
  const auth = await requireUserRole(request, "client", MESSAGE);
  if (!auth.ok) return auth.response;
  const id = parseId((await readJson(request))?.id);
  if (!id) return error("کدوم درخواست؟");
  const done = (await requests.cancelClientRequest(auth.user.id, id)) || (await requests.dismissClientRequest(auth.user.id, id));
  if (!done) return error("این درخواست دیگه باز نیست.", 409);
  return json({ data: { ok: true } });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
export const DELETE = withErrorHandling(_DELETE);
