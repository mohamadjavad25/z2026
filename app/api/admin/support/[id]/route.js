import { error, json, parseId, readJson, withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { isAdminPhone, requireAdmin } from "../../../../lib/admin.js";
import * as admin from "../../../../lib/db/repos/admin.js";
import * as ops from "../../../../lib/db/repos/adminOps.js";
import * as support from "../../../../lib/db/repos/support.js";
import { sendPushToUser } from "../../../../lib/push.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _GET(request, { params }) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const id = parseId((await params).id);
  const found = id ? await support.getTicket(id) : null;
  if (!found) return error("پیدا نشد.", 404);
  return json({ data: found });
}

/**
 * POST { status?, note?, action? }
 * - status: open | in_progress | closed; note: internal note (never shown to the user).
 * - action (reports only): "hide_post" (hides the reported post), "suspend_user" (suspends the reported account / the post's owner),
 *   "dismiss" (nothing to do). Each one closes the ticket and records what was done. Deleting for good stays in the Content/Users tabs
 *   behind the password re-check.
 */
async function _POST(request, { params }) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const id = parseId((await params).id);
  const found = id ? await support.getTicket(id) : null;
  if (!found) return error("پیدا نشد.", 404);
  const { ticket, target } = found;
  const body = (await readJson(request)) || {};
  const log = (action, detail = "", targetUserId = null) =>
    admin.logAction({ adminUserId: gate.admin.id, adminLabel: gate.admin.label, action, targetUserId, detail: `#${ticket.id} ${detail}`.trim() });

  // A reply goes to the user (they see it in their support center and get a push if they allowed it). It can close the ticket in the same go.
  const reply = String(body.reply || "").trim();
  if (reply) {
    if (reply.length > 2000) return error("پاسخ خیلی بلند است (حداکثر ۲۰۰۰ حرف).", 400);
    if (!ticket.user_id) return error("این پیام از مهمان بدون حساب است؛ با شمارهٔ تماسش جواب بده.", 400);
    await support.addMessage({ ticketId: ticket.id, author: "admin", authorUserId: gate.admin.id, body: reply });
    if (body.status === "closed") await support.updateTicket(ticket.id, { status: "closed", resolution: ticket.resolution || "answered" });
    if (body.note !== undefined) await support.updateTicket(ticket.id, { adminNote: body.note });
    await log("support_update", body.status === "closed" ? "پاسخ و بستن" : "پاسخ");
    // Best-effort: a push failure must never fail the reply.
    sendPushToUser(ticket.user_id, { title: "پاسخ پشتیبانی فرفرو", body: reply.slice(0, 120), url: "/" }).catch(() => {});
    return json({ data: { ok: true } });
  }

  const action = String(body.action || "");
  if (action) {
    if (ticket.kind !== "report") return error("این کار فقط برای گزارش‌هاست.", 400);
    if (action === "hide_post") {
      if (ticket.target_type !== "post" || !target) return error("پست پیدا نشد.", 404);
      await ops.setPostPublic(target.id, false);
      await log("post_hide", target.title, target.owner_id);
    } else if (action === "suspend_user") {
      const victimId = ticket.target_type === "post" ? target?.owner_id : target?.id;
      const victimPhone = ticket.target_type === "post" ? target?.owner_phone : target?.phone;
      if (!victimId) return error("حساب پیدا نشد.", 404);
      if (isAdminPhone(victimPhone)) return error("حساب مدیر را نمی‌شود مسدود کرد.", 400);
      await admin.setSuspended(victimId, true);
      await log("suspend", "از طریق گزارش", victimId);
    } else if (action !== "dismiss") {
      return error("درخواست نامعتبر است.", 400);
    }
    const resolution = { hide_post: "hidden_post", suspend_user: "suspended_user", dismiss: "dismissed" }[action];
    const updated = await support.updateTicket(ticket.id, { status: "closed", adminNote: body.note, resolution });
    await log("support_update", `بسته شد: ${resolution}`);
    return json({ data: { ticket: updated } });
  }

  if (body.status !== undefined && !support.TICKET_STATUSES.includes(body.status)) return error("وضعیت نامعتبر است.", 400);
  const updated = await support.updateTicket(ticket.id, { status: body.status, adminNote: body.note, resolution: body.status === "closed" && !ticket.resolution ? "answered" : undefined });
  await log("support_update", body.status ? `وضعیت: ${body.status}` : "یادداشت");
  return json({ data: { ticket: updated } });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
