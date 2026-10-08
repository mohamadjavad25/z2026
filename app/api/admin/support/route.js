import { error, json, parseId, readJson, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireAdmin } from "../../../lib/admin.js";
import * as admin from "../../../lib/db/repos/admin.js";
import * as support from "../../../lib/db/repos/support.js";
import * as users from "../../../lib/db/repos/users.js";
import { sendPushToUser } from "../../../lib/push.js";

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
      awaiting: params.get("awaiting") || "",
      q: params.get("q") || "",
      limit: params.get("limit") || 25,
      offset: params.get("offset") || 0
    })
  });
}

/** POST { userId, subject?, message }: the admin starts a conversation with a user (lands unread in their support center, plus a push). */
async function _POST(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const body = (await readJson(request)) || {};
  const userId = parseId(body.userId);
  const message = String(body.message || "").trim();
  if (!userId) return error("کاربر نامعتبر است.", 400);
  if (message.length < 2 || message.length > 2000) return error("متن پیام را بنویس (تا ۲۰۰۰ حرف).", 400);
  const user = await users.getUserById(userId);
  if (!user) return error("کاربر پیدا نشد.", 404);
  const ticket = await support.createAdminTicket({ userId, phone: user.phone, subject: body.subject, body: message, adminUserId: gate.admin.id });
  await admin.logAction({ adminUserId: gate.admin.id, adminLabel: gate.admin.label, action: "support_update", targetUserId: userId, detail: `#${ticket.id} شروع گفتگو` });
  sendPushToUser(userId, { title: "پیام از پشتیبانی فرفرو", body: message.slice(0, 120), url: "/" }).catch(() => {});
  return json({ data: { id: ticket.id } }, { status: 201 });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
