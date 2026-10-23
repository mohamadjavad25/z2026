import { error, json, readJson, withErrorHandling } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import { getUserFromRequest, isValidIranMobile, normalizeDigits, normalizePhone } from "../../lib/auth.js";
import { checkRateLimit } from "../../lib/rateLimit.js";
import { clientIp } from "../../lib/adminAuth.js";
import * as support from "../../lib/db/repos/support.js";
import { parseAttachments } from "../../lib/supportMedia.js";
import { smsAdminsSupport, supportTopic } from "../../lib/adminSms.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOUR = 60 * 60 * 1000;

/**
 * POST { category, subject, message, phone?, attachments? }: a message to the support inbox, optionally with up to four
 * pictures or one voice note ([{ kind: "image" | "voice", data: "data:...;base64,...", durationMs? }], see app/lib/supportMedia.js).
 * Signed-in users are identified by their session; a guest (e.g. someone locked out) must leave a phone number to be reached on.
 */
async function _POST(request) {
  await ensureDb();
  const body = (await readJson(request)) || {};
  const user = await getUserFromRequest(request);
  const category = support.SUPPORT_CATEGORIES.includes(body.category) ? body.category : "other";
  const subject = normalizeDigits(String(body.subject || "")).trim().slice(0, 120);
  const message = String(body.message || "").trim();
  const files = parseAttachments(body.attachments);
  if (!files.ok) return error(files.error, 400);
  // A screenshot or a voice note says enough on its own; plain text needs a few words.
  if (!files.items.length && message.length < 10) return error("یه کم بیشتر بنویس (دست‌کم ۱۰ حرف).", 400);
  if (message.length > 2000) return error("پیامت خیلی بلنده (حداکثر ۲۰۰۰ حرف).", 400);

  let phone = user?.phone || "";
  if (!user) {
    phone = normalizePhone(body.phone);
    if (!isValidIranMobile(phone)) return error("شماره‌ت رو درست بزن تا بتونیم بهت زنگ بزنیم.", 400);
  }

  const who = user ? `user:${user.id}` : `phone:${phone}`;
  if (!(await checkRateLimit(`support:${who}`, 5, HOUR)).ok || !(await checkRateLimit(`support-ip:${clientIp(request)}`, 20, HOUR)).ok) {
    return error("زیاد پیام فرستادی؛ یه کم دیگه دوباره بزن.", 429);
  }

  const ticket = await support.createTicket({ kind: "support", userId: user?.id ?? null, contactPhone: phone, category, subject, body: message, attachments: files.items });
  smsAdminsSupport("support", { topic: supportTopic(category), who: user?.name || phone });
  return json({ data: { id: ticket.id } }, { status: 201 });
}

export const POST = withErrorHandling(_POST);
