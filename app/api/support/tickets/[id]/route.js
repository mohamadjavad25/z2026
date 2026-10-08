import { error, json, parseId, readJson, requireUser, withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { checkRateLimit } from "../../../../lib/rateLimit.js";
import * as support from "../../../../lib/db/repos/support.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: one of my tickets with its conversation. Opening it marks it as read. Someone else's ticket is a plain 404. */
async function _GET(request, { params }) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  const found = id ? await support.getUserTicket(auth.user.id, id) : null;
  if (!found) return error("گفتگو پیدا نشد.", 404);
  return json({ data: found });
}

/** POST { message }: continue my conversation. A message on a closed ticket reopens it. */
async function _POST(request, { params }) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  const mine = id ? await support.getUserTicket(auth.user.id, id) : null;
  if (!mine) return error("گفتگو پیدا نشد.", 404);
  const message = String(((await readJson(request)) || {}).message || "").trim();
  if (!message) return error("پیامت خالی است.", 400);
  if (message.length > 2000) return error("پیام خیلی بلند است (حداکثر ۲۰۰۰ حرف).", 400);
  if (!(await checkRateLimit(`support-reply:${auth.user.id}`, 30, 60 * 60 * 1000)).ok) return error("پیام‌های زیادی فرستادی. کمی بعد دوباره امتحان کن.", 429);
  const ticket = await support.addMessage({ ticketId: id, author: "user", authorUserId: auth.user.id, body: message });
  return json({ data: { ticket } }, { status: 201 });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
