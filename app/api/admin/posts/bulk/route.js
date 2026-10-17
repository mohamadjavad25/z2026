import { error, json, parseId, readJson, withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { requireAdmin, requireStepUp } from "../../../../lib/admin.js";
import * as admin from "../../../../lib/db/repos/admin.js";
import * as ops from "../../../../lib/db/repos/adminOps.js";

export const runtime = "nodejs";

/** POST { ids: number[], action: "hide" | "show" | "delete" }: up to 200 posts at once. Deleting needs a fresh password check. */
async function _POST(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const body = (await readJson(request)) || {};
  const action = String(body.action || "");
  const ids = Array.isArray(body.ids) ? body.ids.map(parseId).filter(Boolean) : [];
  if (!["hide", "show", "delete"].includes(action) || !ids.length || ids.length > 200) return error("درخواست نامعتبر است.", 400);
  if (action === "delete") {
    const stepUp = requireStepUp(gate);
    if (stepUp) return stepUp;
  }
  const done = await ops.bulkPosts(ids, action);
  for (const post of done) {
    await admin.logAction({ adminUserId: gate.admin.id, adminLabel: gate.admin.label, action: `post_${action}`, targetUserId: post.owner_user_id, detail: `#${post.id} ${post.title} • گروهی` });
  }
  return json({ data: { changed: done.length } });
}

export const POST = withErrorHandling(_POST);
