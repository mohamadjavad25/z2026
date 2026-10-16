import { after } from "next/server";
import { error, json, readJson, validateBody, withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { requireAdmin, requireStepUp } from "../../../../lib/admin.js";
import * as admin from "../../../../lib/db/repos/admin.js";
import * as billing from "../../../../lib/db/repos/billing.js";
import { notifyGranted, presentAccount, presentPayment } from "../../../../lib/billing/service.js";
import { grantSchema } from "../../../../lib/validation/billing.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { userId, days, amountToman, note }: adds days to a salon's or artist's subscription. amountToman > 0 records
 * money taken outside the app (card-to-card, cash) and counts as revenue; 0 is a gift. Password re-check, logged,
 * and it lands in the account's payment history like any payment.
 */
async function _POST(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const stepUp = requireStepUp(gate);
  if (stepUp) return stepUp;
  const valid = validateBody(grantSchema, (await readJson(request)) || {});
  if (!valid.ok) return valid.response;
  const { userId, days, amountToman, note } = valid.data;
  const result = await billing.grantDays({ userId, days, amountRial: amountToman * 10, note, adminLabel: gate.admin.label });
  if (!result.ok) return error(result.error, 400);
  await admin.logAction({
    adminUserId: gate.admin.id,
    adminLabel: gate.admin.label,
    action: "billing_grant",
    targetUserId: userId,
    detail: `${days} روز • ${amountToman ? `${amountToman} تومان` : "هدیه"} • ${note}`
  });
  after(() => notifyGranted(result.payment));
  const state = await billing.getAccountState(userId);
  return json({ data: { payment: presentPayment(result.payment, { admin: true }), account: presentAccount(state) } }, { status: 201 });
}

export const POST = withErrorHandling(_POST);
