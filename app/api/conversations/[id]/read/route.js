import { ensureDb } from "../../../../lib/db/connection.js";
import { error, json, requireUser } from "../../../../lib/http.js";
import * as messages from "../../../../lib/db/repos/messages.js";
import { publishChatEvent } from "../../../../lib/chatEvents.js";

export const runtime = "nodejs";

// Marking read is its own explicit action (not a side effect of GET
// /messages) — a background prefetch or a hidden tab polling for new
// messages must never silently mark them read on the sender's behalf.
export async function POST(request, { params }) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const conversationId = Number(id);
  const result = messages.markConversationRead(conversationId, auth.user.id);
  if (!result) return error("دسترسی به این گفتگو نداری.", 403);
  // Lets the sender's open chat flip single-tick "sent" to double-tick "read"
  // live, instead of only on their next reload/poll.
  if (result.recipients.length) {
    publishChatEvent({
      type: "read",
      conversationId,
      userId: auth.user.id,
      readAt: result.readAt,
      recipients: result.recipients
    });
  }
  return json({ data: { ok: true } });
}
