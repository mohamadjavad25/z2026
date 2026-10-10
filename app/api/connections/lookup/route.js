import { ensureDb } from "../../../lib/db/connection.js";
import { error, json, requireUser, withErrorHandling } from "../../../lib/http.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";
import * as connections from "../../../lib/db/repos/connections.js";
import { parseProfileLink } from "../../../shared/lib/connectCodes.js";

export const runtime = "nodejs";

// What a scanned salon/artist code is, for whoever scanned it (client, salon
// or artist): GET ?code=<scanned text> -> { profile, relation }.
// The action itself goes through the existing endpoints: /api/connections
// (client), /api/salon-invites (salon invites artist), /api/artist/join-salon.
const LOOKUPS_PER_MINUTE = 60;

async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const limited = await checkRateLimit(`connect-lookup:${auth.user.id}`, LOOKUPS_PER_MINUTE, 60 * 1000);
  if (!limited.ok) return error("اسکن زیاد شد؛ یک دقیقه بعد دوباره امتحان کن.", 429);
  const link = parseProfileLink(new URL(request.url).searchParams.get("code") || "");
  if (!link) return error("این کد مال سالن یا آرتیست فرفرو نیست.");
  const result = await connections.lookupProfile(auth.user, link);
  if (!result) return error("این سالن یا آرتیست پیدا نشد.", 404);
  return json({ data: result });
}

export const GET = withErrorHandling(_GET);
