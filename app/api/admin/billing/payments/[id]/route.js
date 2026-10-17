import { after } from "next/server";
import { error, json, notFound, parseId, readJson, validateBody, withErrorHandling } from "../../../../../lib/http.js";
import { ensureDb } from "../../../../../lib/db/connection.js";
import { requireAdmin, requireStepUp } from "../../../../../lib/admin.js";
import * as admin from "../../../../../lib/db/repos/admin.js";
import * as billing from "../../../../../lib/db/repos/billing.js";
import { notifyRefunded, presentAccount, presentPayment, verifyAndSettle } from "../../../../../lib/billing/service.js";
import { refundSchema } from "../../../../../lib/validation/billing.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadDetail(id) {
  const payment = await billing.getPayment(id);
  if (!payment) return null;
  const [state, others] = payment.user_id
    ? await Promise.all([billing.getAccountState(payment.user_id), billing.listPayments({ userId: payment.user_id, limit: 12 })])
    : [null, { rows: [] }];
  return {
    payment: presentPayment(payment, { admin: true }),
    account: presentAccount(state),
    history: others.rows.filter((row) => row.id !== payment.id).map((row) => presentPayment(row, { admin: true }))
  };
}

/** One payment with everything about it, the account's state now, and the account's other payments. */
async function _GET(request, { params }) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const id = parseId((await params).id);
  const detail = id ? await loadDetail(id) : null;
  return detail ? json({ data: detail }) : notFound("این پرداخت پیدا نشد.");
}

/**
 * POST { action: "reverify" }: asks the gateway again about a payment still pending (e.g. after the gateway was down).
 * POST { action: "refund", amountToman, days, note }: records a refund made in the gateway's panel and takes the days
 * off the subscription. Password re-check, logged, once per payment.
 */
async function _POST(request, { params }) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const id = parseId((await params).id);
  const payment = id ? await billing.getPayment(id) : null;
  if (!payment) return notFound("این پرداخت پیدا نشد.");
  const body = (await readJson(request)) || {};
  if (body.action === "refund") return refund(request, gate, payment, body);
  if (body.action !== "reverify") return error("کار نامعتبر.", 400);
  if (payment.status !== "pending") return error("این پرداخت دیگر در انتظار نیست.", 409);
  if (!payment.authority) return error("این پرداخت هیچ‌وقت به درگاه نرسید؛ چیزی برای پرسیدن نیست.", 409);
  const { payment: updated } = await verifyAndSettle(payment);
  await admin.logAction({
    adminUserId: gate.admin.id,
    adminLabel: gate.admin.label,
    action: "billing_reverify",
    targetUserId: payment.user_id,
    detail: `پرداخت ${payment.id} • نتیجه: ${updated?.status === "paid" ? "پرداخت‌شده" : updated?.status === "failed" ? "ناموفق" : "هنوز نامعلوم"}`
  });
  return json({ data: await loadDetail(payment.id) });
}

async function refund(request, gate, payment, body) {
  const stepUp = requireStepUp(gate);
  if (stepUp) return stepUp;
  const valid = validateBody(refundSchema, body);
  if (!valid.ok) return valid.response;
  const { amountToman, days, note } = valid.data;
  const result = await billing.recordRefund({ paymentId: payment.id, amountRial: amountToman * 10, days, note, adminLabel: gate.admin.label });
  if (!result.ok) return error(result.error, result.status);
  await admin.logAction({
    adminUserId: gate.admin.id,
    adminLabel: gate.admin.label,
    action: "billing_refund",
    targetUserId: payment.user_id,
    detail: `پرداخت ${payment.id} (${payment.receipt_no || ""}) • ${amountToman} تومان • ${days} روز کم شد • ${note}`
  });
  after(() => notifyRefunded(result.payment));
  return json({ data: await loadDetail(payment.id) });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
