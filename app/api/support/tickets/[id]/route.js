import { error, json, parseId, readJson, requireUser, withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { checkRateLimit } from "../../../../lib/rateLimit.js";
import * as support from "../../../../lib/db/repos/support.js";
import { parseAttachments } from "../../../../lib/supportMedia.js";
import { smsAdminsSupport } from "../../../../lib/adminSms.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: one of my tickets with its conversation. Opening it marks it as read. Someone else's ticket is a plain 404. */
async function _GET(request, { params }) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  const found = id ? await support.getUserTicket(auth.user.id, id) : null;
  if (!found) return error("این گفت‌وگو رو پیدا نکردیم.", 404);
  return json({ data: found });
}

/** POST { message, attachments? }: continue my conversation (text, pictures or a voice note). A message on a closed ticket reopens it. */
async function _POST(request, { params }) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  const mine = id ? await support.getUserTicket(auth.user.id, id) : null;
  if (!mine) return error("این گفت‌وگو رو پیدا نکردیم.", 404);
  const body = (await readJson(request)) || {};
  const message = String(body.message || "").trim();
  const files = parseAttachments(body.attachments);
  if (!files.ok) return error(files.error, 400);
  if (!message && !files.items.length) return error("پیامت خالیه.", 400);
  if (message.length > 2000) return error("پیامت خیلی بلنده (حداکثر ۲۰۰۰ حرف).", 400);
  if (!(await checkRateLimit(`support-reply:${auth.user.id}`, 30, 60 * 60 * 1000)).ok) return error("زیاد پیام فرستادی؛ یه کم دیگه دوباره بزن.", 429);
  const ticket = await support.addMessage({ ticketId: id, author: "user", authorUserId: auth.user.id, body: message, attachments: files.items });
  smsAdminsSupport("support-reply", { topic: "جواب تازه", who: auth.user.name || auth.user.phone });
  return json({ data: { ticket } }, { status: 201 });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
