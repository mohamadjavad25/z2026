import { error, json, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireAdmin, requireStepUp } from "../../../lib/admin.js";
import * as admin from "../../../lib/db/repos/admin.js";
import * as ops from "../../../lib/db/repos/adminOps.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = { users: "کاربران", bookings: "رزروها", actions: "گزارش فعالیت‌ها" };

/** GET ?kind=users|bookings|actions: rows for a spreadsheet (the panel turns them into CSV). Contains phone numbers, so it needs a fresh password check and is logged. */
async function _GET(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const stepUp = requireStepUp(gate);
  if (stepUp) return stepUp;
  const kind = new URL(request.url).searchParams.get("kind") || "";
  if (!KINDS[kind]) return error("نوع خروجی نامعتبر است.", 400);
  const rows = await ops.exportRows(kind);
  await admin.logAction({ adminLabel: gate.admin.label, action: "export", detail: `${KINDS[kind]} • ${rows.length} ردیف` });
  return json({ data: { kind, rows } });
}

export const GET = withErrorHandling(_GET);
