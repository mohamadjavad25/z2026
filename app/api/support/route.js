import { error, json, readJson, withErrorHandling } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import { getUserFromRequest, isValidIranMobile, normalizeDigits, normalizePhone } from "../../lib/auth.js";
import { checkRateLimit } from "../../lib/rateLimit.js";
import { clientIp } from "../../lib/adminAuth.js";
import * as support from "../../lib/db/repos/support.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOUR = 60 * 60 * 1000;

/**
 * POST { category, subject, message, phone? }: a message to the support inbox.
 * Signed-in users are identified by their session; a guest (e.g. someone locked out) must leave a phone number to be reached on.
 */
async function _POST(request) {
  await ensureDb();
  const body = (await readJson(request)) || {};
  const user = await getUserFromRequest(request);
  const category = support.SUPPORT_CATEGORIES.includes(body.category) ? body.category : "other";
  const subject = normalizeDigits(String(body.subject || "")).trim().slice(0, 120);
  const message = String(body.message || "").trim();
  if (message.length < 10) return error("پیامت را کمی کامل‌تر بنویس (حداقل ۱۰ حرف).", 400);
  if (message.length > 2000) return error("پیام خیلی بلند است (حداکثر ۲۰۰۰ حرف).", 400);

  let phone = user?.phone || "";
  if (!user) {
    phone = normalizePhone(body.phone);
    if (!isValidIranMobile(phone)) return error("شمارهٔ موبایلت را درست وارد کن تا بتوانیم با تو تماس بگیریم.", 400);
  }

  const who = user ? `user:${user.id}` : `phone:${phone}`;
  if (!(await checkRateLimit(`support:${who}`, 5, HOUR)).ok || !(await checkRateLimit(`support-ip:${clientIp(request)}`, 20, HOUR)).ok) {
    return error("پیام‌های زیادی فرستادی. کمی بعد دوباره امتحان کن.", 429);
  }

  const ticket = await support.createTicket({ kind: "support", userId: user?.id ?? null, contactPhone: phone, category, subject, body: message });
  return json({ data: { id: ticket.id } }, { status: 201 });
}

export const POST = withErrorHandling(_POST);
