import { error, json, readJson, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireAdmin, requireStepUp } from "../../../lib/admin.js";
import * as admin from "../../../lib/db/repos/admin.js";
import * as control from "../../../lib/db/repos/adminControl.js";
import { sendPushToUser } from "../../../lib/push.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Pushing to a few thousand devices takes a while; give it the time instead of cutting it off half way.
export const maxDuration = 300;

/** GET ?segment=: past broadcasts, plus (with a segment) how many people it reaches right now. */
async function _GET(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const segment = new URL(request.url).searchParams.get("segment") || "";
  const [history, reach] = await Promise.all([
    control.listBroadcasts(30),
    control.SEGMENTS[segment] ? control.countSegment(segment) : null
  ]);
  return json({ data: { history, reach } });
}

/** Sends to every user id, a few at a time; returns how many devices accepted it. */
async function pushAll(userIds, message) {
  let sent = 0;
  let next = 0;
  const worker = async () => {
    while (next < userIds.length) {
      const userId = userIds[next];
      next += 1;
      const result = await sendPushToUser(userId, message).catch(() => null);
      sent += result?.sent || 0;
    }
  };
  await Promise.all(Array.from({ length: Math.min(12, userIds.length) }, worker));
  return sent;
}

/**
 * POST { segment, channels: ["inbox", "push"], title?, body, url? }: one message to a whole group.
 * "inbox" puts it in each person's support center; "push" sends a notification to their devices. Needs a fresh password check.
 */
async function _POST(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const stepUp = requireStepUp(gate);
  if (stepUp) return stepUp;
  const body = (await readJson(request)) || {};
  const segment = String(body.segment || "");
  const channels = Array.isArray(body.channels) ? [...new Set(body.channels.filter((channel) => channel === "inbox" || channel === "push"))] : [];
  const title = String(body.title || "").trim().slice(0, 120);
  const text = String(body.body || "").trim();
  const url = String(body.url || "").trim();
  if (!control.SEGMENTS[segment]) return error("گروه گیرندگان نامعتبر است.", 400);
  if (!channels.length) return error("دست‌کم یک راه ارسال انتخاب کن.", 400);
  if (text.length < 2 || text.length > 1000) return error("متن پیام را بنویس (تا ۱۰۰۰ حرف).", 400);
  if (url && !url.startsWith("/")) return error("پیوند اعلان باید یک صفحه از خود اپ باشد (با / شروع شود).", 400);

  const { recipients } = await control.countSegment(segment);
  if (!recipients) return error("این گروه الان کسی را ندارد.", 400);
  // Recorded before anything goes out: the same message to the same group twice in a few minutes is almost always a
  // double click, or a retry while the first one is still sending.
  const claimed = await control.claimBroadcast({ segment, channels, title, body: text, url, recipients, adminLabel: gate.admin.label });
  if (!claimed) return error("همین پیام چند دقیقه پیش برای همین گروه فرستاده شد.", 409);
  const inboxed = channels.includes("inbox") ? await control.inboxSegment(segment, { title: title || "پیام از فرفرو", body: text }) : 0;
  const pushed = channels.includes("push")
    ? await pushAll(await control.pushableUserIds(segment), { title: title || "فرفرو", body: text.slice(0, 180), url: url || "/", ttl: 3 * 24 * 3600 })
    : 0;
  const record = (await control.finishBroadcast(claimed.id, { inboxed, pushed })) || claimed;
  await admin.logAction({ adminLabel: gate.admin.label, action: "broadcast", detail: `#${record.id} ${segment} • ${recipients} نفر • ${text.slice(0, 80)}` });
  return json({ data: { broadcast: record } }, { status: 201 });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
