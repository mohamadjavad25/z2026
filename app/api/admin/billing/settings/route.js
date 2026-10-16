import { error, json, readJson, validateBody, withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { requireAdmin, requireStepUp } from "../../../../lib/admin.js";
import * as admin from "../../../../lib/db/repos/admin.js";
import * as billing from "../../../../lib/db/repos/billing.js";
import { billingSettingsSchema } from "../../../../lib/validation/billing.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT { enabled, graceDays }. Switching billing on is the step that starts every account's free
 * month and, once a gateway is ready, closes accounts that do not pay: it asks for the password again and is logged.
 */
async function _PUT(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const stepUp = requireStepUp(gate);
  if (stepUp) return stepUp;
  const valid = validateBody(billingSettingsSchema, (await readJson(request)) || {});
  if (!valid.ok) return valid.response;
  const before = await billing.getBillingSettings({ fresh: true });
  const saved = await billing.saveBillingSettings(valid.data, gate.admin.label);
  const parts = [
    `اشتراک: ${saved.enabled ? "روشن" : "خاموش"}`,
    `مهلت: ${saved.graceDays} روز`,
    !before.launchedAt && saved.launchedAt ? "شروع ماه رایگان همه" : ""
  ].filter(Boolean);
  await admin.logAction({ adminUserId: gate.admin.id, adminLabel: gate.admin.label, action: "billing_settings", detail: parts.join(" • ") });
  return json({ data: { settings: saved } });
}

export const PUT = withErrorHandling(_PUT);
