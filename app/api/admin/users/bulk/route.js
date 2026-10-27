import { error, json, parseId, readJson, withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { requireAdmin, adminPhoneList } from "../../../../lib/admin.js";
import * as admin from "../../../../lib/db/repos/admin.js";
import * as ops from "../../../../lib/db/repos/adminOps.js";

export const runtime = "nodejs";

const LABEL = { suspend: "مسدود", unsuspend: "رفع مسدودی", logout: "خروج اجباری" };

/** POST { ids: number[], action: "suspend" | "unsuspend" | "logout", reason? }: one action on up to 200 accounts. Admin accounts are always skipped. */
async function _POST(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const body = (await readJson(request)) || {};
  const action = String(body.action || "");
  const ids = Array.isArray(body.ids) ? body.ids.map(parseId).filter(Boolean) : [];
  if (!LABEL[action] || !ids.length || ids.length > 200) return error("درخواست نامعتبر است.", 400);
  const reason = String(body.reason || "").trim().slice(0, 200);
  const done = await ops.bulkUsers(ids, action, await ops.userIdsByPhones(adminPhoneList()));
  for (const user of done) {
    await admin.logAction({
      adminLabel: gate.admin.label,
      action: action === "logout" ? "force_logout" : action,
      targetUserId: user.id,
      detail: [`گروهی (${ids.length})`, reason].filter(Boolean).join(" • ")
    });
  }
  return json({ data: { changed: done.length, skipped: ids.length - done.length } });
}

export const POST = withErrorHandling(_POST);
