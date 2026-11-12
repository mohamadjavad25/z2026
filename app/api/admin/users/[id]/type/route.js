import { error, json, parseId, withErrorHandling } from "../../../../../lib/http.js";
import { ensureDb } from "../../../../../lib/db/connection.js";
import { isAdminPhone, requireAdmin, requireStepUp } from "../../../../../lib/admin.js";
import * as admin from "../../../../../lib/db/repos/admin.js";
import * as ops from "../../../../../lib/db/repos/adminOps.js";
import { convertSalonToArtist, previewSalonToArtist } from "../../../../../lib/db/repos/accountType.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: can this salon become an artist, and what moves (services, نمونه‌کارها, connected clients). */
async function _GET(request, { params }) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const id = parseId((await params).id);
  const preview = id ? await previewSalonToArtist(id) : null;
  if (!preview) return error("کاربر پیدا نشد.", 404);
  return json({ data: preview });
}

/** POST: turns a salon account into an artist account (owner 2026-11-12). Needs a fresh password check. */
async function _POST(request, { params }) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const stepUp = requireStepUp(gate);
  if (stepUp) return stepUp;
  const id = parseId((await params).id);
  const detail = id ? await ops.getUserDetail(id) : null;
  if (!detail) return error("کاربر پیدا نشد.", 404);
  if (isAdminPhone(detail.user.phone)) return error("حساب مدیر رو نمی‌شه عوض کرد.", 400);
  const result = await convertSalonToArtist(id);
  if (!result) return error("کاربر پیدا نشد.", 404);
  if (!result.ok) return json({ error: result.message, code: result.code, count: result.count || 0 }, { status: 409 });
  await admin.logAction({
    adminLabel: gate.admin.label,
    action: "salon_to_artist",
    targetUserId: id,
    detail: `${detail.user.name || ""} · ${result.services} خدمت`
  });
  return json({ data: { ok: true, services: result.services } });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
