import { ensureDb } from "../../../lib/db/connection.js";
import { error, json, notFound, requireUser } from "../../../lib/http.js";
import * as messages from "../../../lib/db/repos/messages.js";
import { publishChatEvent } from "../../../lib/chatEvents.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const conversation = messages.getConversation(Number(id), auth.user.id);
  if (!conversation) return notFound("گفتگو پیدا نشد.");
  return json({ data: { conversation } });
}

/** Body: { title } to rename a group, or { addMemberIds: [...] } to invite members. */
export async function PATCH(request, { params }) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const conversationId = Number(id);
  const body = await request.json().catch(() => ({}));

  if (Array.isArray(body.addMemberIds)) {
    const limited = checkRateLimit(`conversation-update:${auth.user.id}`, 20, 60_000);
    if (!limited.ok) return error("درخواست‌های زیاد. کمی صبر کن.", 429);
    const result = messages.addMembers(conversationId, auth.user.id, body.addMemberIds);
    if (!result.ok) return error(result.error, result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 400);
    publishChatEvent({ type: "conversation", conversationId, recipients: (result.conversation.members || []).map((m) => m.id) });
    return json({ data: { conversation: result.conversation } });
  }

  if (typeof body.title === "string") {
    const result = messages.renameGroup(conversationId, auth.user.id, body.title);
    if (!result.ok) return error(result.error, result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 400);
    publishChatEvent({ type: "conversation", conversationId, recipients: (result.conversation.members || []).map((m) => m.id) });
    return json({ data: { conversation: result.conversation } });
  }

  return error("درخواست نامعتبر است.", 400);
}

/** Removes a member: body { userId } (defaults to the caller — "leave"). Only the group creator may remove someone else. */
export async function DELETE(request, { params }) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const conversationId = Number(id);
  const body = await request.json().catch(() => ({}));
  const targetUserId = body.userId ? Number(body.userId) : auth.user.id;

  const conversation = messages.getConversation(conversationId, auth.user.id);
  const recipients = conversation?.members?.map((m) => m.id) || [];

  const result = messages.removeMember(conversationId, auth.user.id, targetUserId);
  if (!result.ok) return error(result.error, result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 400);
  publishChatEvent({ type: "conversation", conversationId, recipients });
  return json({ data: { ok: true, deleted: result.deleted } });
}
