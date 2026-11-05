import { error, json, parseId, withErrorHandling } from "../../../../../lib/http.js";
import { ensureDb } from "../../../../../lib/db/connection.js";
import { requireAdmin } from "../../../../../lib/admin.js";
import { getUserFootprint } from "../../../../../lib/db/repos/activity.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: one person's visits, what happened in each, and who saw their public page. */
async function _GET(request, { params }) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const id = parseId((await params).id);
  if (!id) return error("کاربر پیدا نشد.", 404);
  return json({ data: await getUserFootprint(id) });
}

export const GET = withErrorHandling(_GET);
