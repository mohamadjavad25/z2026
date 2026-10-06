import { error, json, parseId, readJson, withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { requireAdmin, requireStepUp } from "../../../../lib/admin.js";
import * as admin from "../../../../lib/db/repos/admin.js";
import * as ops from "../../../../lib/db/repos/adminOps.js";

export const runtime = "nodejs";

/** POST { action: "hide" | "show" | "delete" }. Hiding is reversible; deleting needs a fresh password check. */
async function _POST(request, { params }) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const id = parseId((await params).id);
  const action = String(((await readJson(request)) || {}).action || "");
  if (!id || !["hide", "show", "delete"].includes(action)) return error("درخواست نامعتبر است.", 400);
  if (action === "delete") {
    const stepUp = requireStepUp(gate);
    if (stepUp) return stepUp;
  }
  const post = action === "delete" ? await ops.deletePost(id) : await ops.setPostPublic(id, action === "show");
  if (!post) return error("پست پیدا نشد.", 404);
  await admin.logAction({ adminUserId: gate.admin.id, adminLabel: gate.admin.label, action: `post_${action}`, targetUserId: post.owner_user_id, detail: `#${post.id} ${post.title}` });
  return json({ data: { post } });
}

export const POST = withErrorHandling(_POST);
