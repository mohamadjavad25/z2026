import { error, json, parseId, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireAdmin } from "../../../lib/admin.js";
import * as billing from "../../../lib/db/repos/billing.js";
import { gatewayStatus } from "../../../lib/payments/index.js";
import { presentPayment } from "../../../lib/billing/service.js";
import { PLANS, TRIAL_DAYS, rialToToman } from "../../../lib/billing/plans.js";
import { SMS_TEMPLATES } from "../../../lib/smsTemplates.js";
import { smsProviderName, templateConfigured } from "../../../lib/sms.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The admin's «پرداخت‌ها» page: settings, gateway and SMS readiness (names only, never secret values), money and
 * account counts, and the ledger (filters: status, source, q, userId; paged).
 */
async function _GET(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const query = request.nextUrl.searchParams;
  const [settings, stats, list] = await Promise.all([
    billing.getBillingSettings({ fresh: true }),
    billing.billingStats(),
    billing.listPayments({
      status: query.get("status") || "",
      source: query.get("source") || "",
      q: query.get("q") || "",
      userId: parseId(query.get("userId")),
      offset: Number(query.get("offset")) || 0,
      limit: Number(query.get("limit")) || 30
    })
  ]);
  return json({
    data: {
      settings,
      trialDays: TRIAL_DAYS,
      gateway: gatewayStatus(),
      sms: {
        provider: smsProviderName(),
        templates: Object.entries(SMS_TEMPLATES).map(([key, template]) => ({ key, label: template.label, env: template.env, configured: templateConfigured(key) }))
      },
      plans: PLANS.map((plan) => ({ id: plan.id, role: plan.role, title: plan.title, days: plan.days, amountToman: rialToToman(plan.amountRial) })),
      stats,
      payments: list.rows.map((row) => presentPayment(row, { admin: true })),
      total: list.total,
      counts: list.counts
    }
  });
}

export const GET = withErrorHandling(_GET);
