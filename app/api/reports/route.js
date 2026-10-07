import { error, json, parseId, readJson, withErrorHandling } from "../../lib/http.js";
import { ensureDb, getDb, get } from "../../lib/db/connection.js";
import { getUserFromRequest } from "../../lib/auth.js";
import { checkRateLimit } from "../../lib/rateLimit.js";
import * as support from "../../lib/db/repos/support.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOUR = 60 * 60 * 1000;

/**
 * POST { targetType: "post" | "user", targetId, reason, note? }: report a post or an account to the admin.
 * Needs a signed-in user (so reports can't be mass-produced anonymously); you can't report yourself or your own post;
 * reporting the same thing twice is accepted but does not create a second ticket.
 */
async function _POST(request) {
  await ensureDb();
  const user = await getUserFromRequest(request);
  if (!user) return error("برای گزارش‌دادن باید وارد شوی.", 401);
  const body = (await readJson(request)) || {};
  const targetType = body.targetType === "post" || body.targetType === "user" ? body.targetType : "";
  const targetId = parseId(body.targetId);
  const reason = support.REPORT_REASONS.includes(body.reason) ? body.reason : "";
  const note = String(body.note || "").trim().slice(0, 500);
  if (!targetType || !targetId || !reason) return error("درخواست نامعتبر است.", 400);

  if (!(await checkRateLimit(`report:${user.id}`, 10, HOUR)).ok) return error("گزارش‌های زیادی فرستادی. کمی بعد دوباره امتحان کن.", 429);

  const db = await getDb();
  let ownerId;
  let label;
  if (targetType === "post") {
    const post = await get(db, "SELECT id, title, owner_user_id FROM posts WHERE id = $1", [targetId]);
    if (!post) return error("این پست پیدا نشد.", 404);
    ownerId = post.owner_user_id;
    label = post.title;
  } else {
    const target = await get(db, "SELECT id, name FROM users WHERE id = $1", [targetId]);
    if (!target) return error("این حساب پیدا نشد.", 404);
    ownerId = target.id;
    label = target.name;
  }
  if (ownerId === user.id) return error("نمی‌توانی مورد مربوط به خودت را گزارش کنی.", 400);

  const ticket = await support.createTicket({
    kind: "report",
    userId: user.id,
    contactPhone: user.phone,
    category: reason,
    subject: String(label || "").slice(0, 120),
    body: note,
    targetType,
    targetId
  });
  return json({ data: { id: ticket.id, already: ticket.already } }, { status: ticket.already ? 200 : 201 });
}

export const POST = withErrorHandling(_POST);
