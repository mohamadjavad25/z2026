import { ensureDb } from "../../../../lib/db/connection.js";
import { error, json, requireUser } from "../../../../lib/http.js";
import * as messages from "../../../../lib/db/repos/messages.js";
import { parseStoryDataUrl, ALLOWED_POSTER_TYPES } from "../../../../lib/db/repos/stories.js";
import { publishChatEvent } from "../../../../lib/chatEvents.js";
import { checkRateLimit } from "../../../../lib/rateLimit.js";
import { enrichOrderCards } from "../../../../lib/chatOrderCards.js";

export const runtime = "nodejs";

// A chat image travels inline as a data: URL in the message row (same
// approach the rest of the app uses for product/profile images — no blob
// storage service exists here). Capped well below the story-poster limit
// since a conversation accumulates many of these over time, not one.
const MAX_ATTACHMENT_LENGTH = 2_000_000;

export async function GET(request, { params }) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit")) || undefined;
  const before = Number(searchParams.get("before")) || undefined;

  const result = messages.listMessages(Number(id), auth.user.id, { limit, before });
  if (!result) return error("دسترسی به این گفتگو نداری.", 403);
  enrichOrderCards(result.messages);
  return json({ data: result });
}

export async function POST(request, { params }) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const conversationId = Number(id);

  const limited = checkRateLimit(`message-send:${auth.user.id}`, 15, 10_000);
  if (!limited.ok) return error("پیام‌های زیاد. چند ثانیه صبر کن.", 429);

  const body = await request.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body : "";

  let attachmentUrl = "";
  let attachmentType = "";
  if (typeof body.attachment === "string" && body.attachment) {
    if (body.attachment.length > MAX_ATTACHMENT_LENGTH) return error("حجم عکس بیش از حد مجاز است.", 413);
    const parsed = parseStoryDataUrl(body.attachment, ALLOWED_POSTER_TYPES);
    if (!parsed) return error("فرمت عکس مجاز نیست (jpeg، png، webp یا gif).", 400);
    attachmentUrl = body.attachment;
    attachmentType = "image";
  }

  const result = messages.sendMessage(conversationId, auth.user.id, { body: text, attachmentUrl, attachmentType });
  if (!result.ok) {
    if (result.error === "forbidden") return error("دسترسی به این گفتگو نداری.", 403);
    return error(result.error, 400);
  }

  publishChatEvent({ type: "message", conversationId, message: result.message, recipients: result.recipients });
  return json({ data: { message: result.message } }, { status: 201 });
}
