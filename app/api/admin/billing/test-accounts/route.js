import { error, json, readJson, validateBody, withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { requireAdmin, requireStepUp } from "../../../../lib/admin.js";
import * as admin from "../../../../lib/db/repos/admin.js";
import * as billing from "../../../../lib/db/repos/billing.js";
import { testAccountsSchema } from "../../../../lib/validation/billing.js";
import { normalizePhone } from "../../../../shared/lib/phone.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT { phones }: the owner's own test numbers. An account with one of these numbers is never charged or closed, and
 * is left out of the directory and of every search (its page link and booking still work, so the owner can try every
 * role). It follows the number, not the account: sign-up again after deleting works the same. Asks for the password
 * again, because it exempts accounts from payment, and is logged.
 */
async function _PUT(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const stepUp = requireStepUp(gate);
  if (stepUp) return stepUp;
  const body = (await readJson(request)) || {};
  const valid = validateBody(testAccountsSchema, { phones: Array.isArray(body.phones) ? body.phones.map((phone) => normalizePhone(phone)) : [] });
  if (!valid.ok) return valid.response;
  const saved = await billing.saveTestPhones(valid.data.phones, gate.admin.label);
  await admin.logAction({ adminLabel: gate.admin.label, action: "billing_test_accounts", detail: `شماره‌های آزمایشی: ${saved.length}` });
  return json({ data: { testPhones: saved } });
}

export const PUT = withErrorHandling(_PUT);
