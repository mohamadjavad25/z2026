import { ensureDb } from "../../../lib/db/connection.js";
import { error, json, requireUserRole, withErrorHandling } from "../../../lib/http.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";
import * as connections from "../../../lib/db/repos/connections.js";

export const runtime = "nodejs";

// Find a salon/artist by public link, phone number or name.
// GET ?q=... -> { by: "link" | "phone" | "name" | "none", results: [...] }
//
// Throttled per client so the phone lookup cannot be used to sweep numbers.
const SEARCHES_PER_MINUTE = 40;

async function _GET(request) {
  await ensureDb();
  const auth = await requireUserRole(request, "client");
  if (!auth.ok) return auth.response;
  const limited = await checkRateLimit(`connect-search:${auth.user.id}`, SEARCHES_PER_MINUTE, 60 * 1000);
  if (!limited.ok) return error("جستجو زیاد شد؛ یک دقیقه بعد دوباره امتحان کن.", 429);
  const query = new URL(request.url).searchParams.get("q") || "";
  return json({ data: await connections.searchProfiles(query, auth.user.id) });
}

export const GET = withErrorHandling(_GET);
