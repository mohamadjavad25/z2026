import { error, json, parseId, readJson, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireAdmin } from "../../../lib/admin.js";
import * as admin from "../../../lib/db/repos/admin.js";
import { reviewAnswer, surveyReport } from "../../../lib/db/repos/welcomeSurvey.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?role=&days=: what people said in the welcome survey, narrowed to a role and a period. */
async function _GET(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const params = new URL(request.url).searchParams;
  return json({ data: await surveyReport({ role: params.get("role") || "", days: Number(params.get("days")) || 0 }) });
}

/** POST { userId, seen, note? }: mark one answer seen (or not) and keep a short note on it. */
async function _POST(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const body = (await readJson(request)) || {};
  const userId = parseId(body.userId);
  if (!userId) return error("کاربر نامعتبر است.", 400);
  if (typeof body.seen !== "boolean") return error("وضعیت نامعتبر است.", 400);
  if (!(await reviewAnswer(userId, { seen: body.seen, note: body.note }))) return error("این کاربر جواب نداده.", 404);
  await admin.logAction({ adminLabel: gate.admin.label, action: "survey_review", targetUserId: userId, detail: body.seen ? "جواب نظرسنجی دیده شد" : "علامت «دیدم» برداشته شد" });
  return json({ data: { ok: true } });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
