import { error, json, parseId, readJson, withErrorHandling } from "../../../../../lib/http.js";
import { ensureDb } from "../../../../../lib/db/connection.js";
import { requireAdmin } from "../../../../../lib/admin.js";
import * as admin from "../../../../../lib/db/repos/admin.js";
import * as ops from "../../../../../lib/db/repos/adminOps.js";
import { sendPushToUser } from "../../../../../lib/push.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = ["salon", "artist"];

async function _GET(request, { params }) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const { kind, id: rawId } = await params;
  const id = parseId(rawId);
  const detail = KINDS.includes(kind) && id ? await ops.getBookingDetail(kind, id) : null;
  if (!detail) return error("رزرو پیدا نشد.", 404);
  return json({ data: detail });
}

const FAILURE = { missing: ["رزرو پیدا نشد.", 404], inactive: ["این رزرو دیگر فعال نیست.", 409], past: ["زمان این رزرو گذشته است.", 409] };

/**
 * POST { action: "cancel", reason, notify? }: the admin cancels an active, upcoming booking (a dispute, a fake request).
 * Both people get a push (unless notify is false); the reason goes to the audit log.
 */
async function _POST(request, { params }) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const { kind, id: rawId } = await params;
  const id = parseId(rawId);
  const body = (await readJson(request)) || {};
  if (!KINDS.includes(kind) || !id || body.action !== "cancel") return error("درخواست نامعتبر است.", 400);
  const reason = String(body.reason || "").trim();
  if (reason.length < 3 || reason.length > 300) return error("دلیل لغو را بنویس (۳ تا ۳۰۰ حرف).", 400);
  const before = await ops.getBookingDetail(kind, id);
  if (!before) return error("رزرو پیدا نشد.", 404);
  const result = await ops.cancelBookingAsAdmin(kind, id);
  if (!result.ok) {
    const [message, status] = FAILURE[result.error] || ["لغو انجام نشد.", 409];
    return error(message, status);
  }
  const { booking } = before;
  await admin.logAction({
    adminUserId: gate.admin.id,
    adminLabel: gate.admin.label,
    action: "booking_cancel",
    targetUserId: booking.client_user_id || booking.provider_id || null,
    detail: `${kind}#${id} ${booking.service || ""} ${booking.booking_date} ${booking.time} • ${reason}`
  });
  if (body.notify !== false) {
    const text = `رزرو «${booking.service || "خدمت"}» در ${booking.booking_date} ساعت ${booking.time} از طرف پشتیبانی فرفرو لغو شد. ${reason}`.slice(0, 200);
    for (const userId of [booking.client_user_id, booking.provider_id].filter(Boolean)) {
      sendPushToUser(userId, { title: "لغو رزرو", body: text, url: "/" }).catch(() => {});
    }
  }
  return json({ data: { ok: true } });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
