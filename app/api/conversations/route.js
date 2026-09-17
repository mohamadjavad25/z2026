import { ensureDb } from "../../lib/db/connection.js";
import { error, json, requireUser } from "../../lib/http.js";
import * as messages from "../../lib/db/repos/messages.js";
import * as users from "../../lib/db/repos/users.js";
import { checkRateLimit } from "../../lib/rateLimit.js";
import { publishChatEvent } from "../../lib/chatEvents.js";

export const runtime = "nodejs";

export async function GET(request) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit")) || undefined;
  const cursor = Number(searchParams.get("cursor")) || undefined;
  const result = messages.listConversations(auth.user.id, { limit, cursor });
  return json({ data: result });
}

export async function POST(request) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;

  const limited = checkRateLimit(`conversation-create:${auth.user.id}`, 20, 60_000);
  if (!limited.ok) return error("درخواست‌های زیاد. کمی صبر کن.", 429);

  const body = await request.json().catch(() => ({}));

  if (body.type === "group") {
    const result = messages.createGroupConversation(auth.user.id, body.title, body.memberIds);
    if (!result.ok) return error(result.error, 400);
    publishChatEvent({
      type: "conversation",
      conversationId: result.conversation.id,
      recipients: (result.conversation.members || []).map((m) => m.id)
    });
    return json({ data: { conversation: result.conversation } }, { status: 201 });
  }

  const peerId = Number(body.peerUserId);
  if (!peerId || peerId === auth.user.id) return error("گیرنده نامعتبر است.", 400);
  const peer = users.getUserById(peerId);
  if (!peer) return error("گیرنده یافت نشد.", 404);

  const conversation = messages.getOrCreateDirectConversation(auth.user.id, peerId);
  if (!conversation) return error("ایجاد گفتگو انجام نشد.", 400);
  publishChatEvent({ type: "conversation", conversationId: conversation.id, recipients: [auth.user.id, peerId] });

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (text) {
    if (text.length > messages.MAX_MESSAGE_LENGTH) return error("پیام خیلی طولانی است.", 400);
    const sendResult = messages.sendMessage(conversation.id, auth.user.id, { body: text });
    if (sendResult.ok) {
      publishChatEvent({ type: "message", conversationId: conversation.id, message: sendResult.message, recipients: sendResult.recipients });
    }
  }

  return json({ data: { conversation } }, { status: 201 });
}
