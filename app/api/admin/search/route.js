import { error, json, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireAdmin } from "../../../lib/admin.js";
import * as ops from "../../../lib/db/repos/adminOps.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?q=: the top bar's quick search across accounts, posts and support tickets (3+ characters). */
async function _GET(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  return json({ data: await ops.searchAll(new URL(request.url).searchParams.get("q") || "") });
}

export const GET = withErrorHandling(_GET);
