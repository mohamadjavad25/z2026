import { error, json, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireAdmin } from "../../../lib/admin.js";
import * as support from "../../../lib/db/repos/support.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?status=&kind=&q=&offset=: the support inbox (messages and reports), open ones first. */
async function _GET(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const params = new URL(request.url).searchParams;
  return json({
    data: await support.listTickets({
      status: params.get("status") || "",
      kind: params.get("kind") || "",
      q: params.get("q") || "",
      limit: params.get("limit") || 25,
      offset: params.get("offset") || 0
    })
  });
}

export const GET = withErrorHandling(_GET);
