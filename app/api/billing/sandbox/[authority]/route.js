import { error, json, notFound, readJson, withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { getPaymentByAuthority, mergePaymentPayload } from "../../../../lib/db/repos/billing.js";
import { selectedGatewayId } from "../../../../lib/payments/index.js";
import { sandboxAnswer } from "../../../../lib/payments/sandbox.js";
import { rialToToman } from "../../../../lib/billing/plans.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The pretend bank behind /pay/sandbox/<authority>. Exists only while FRFRO_PAYMENT_GATEWAY=sandbox; otherwise every
 * call is a 404, so it can never confirm anything on a site that takes real payments.
 */
const sandboxOn = () => selectedGatewayId() === "sandbox";

async function load(params) {
  const payment = await getPaymentByAuthority("sandbox", (await params).authority);
  return payment && payment.source === "gateway" ? payment : null;
}

async function _GET(request, { params }) {
  if (!sandboxOn()) return notFound();
  await ensureDb();
  const payment = await load(params);
  if (!payment) return notFound("این پرداخت آزمایشی پیدا نشد.");
  return json({ data: { title: payment.plan_title, amountToman: rialToToman(payment.amount_rial), status: payment.status } });
}

/** POST { action: "pay" | "cancel" } (and "pay-wrong-amount" for tests): records the answer and gives the address back to the site. */
async function _POST(request, { params }) {
  if (!sandboxOn()) return notFound();
  await ensureDb();
  const payment = await load(params);
  if (!payment) return notFound("این پرداخت آزمایشی پیدا نشد.");
  const action = String((await readJson(request))?.action || "");
  if (!["pay", "cancel", "pay-wrong-amount"].includes(action)) return error("دکمهٔ نامعتبر.", 400);
  if (payment.status !== "pending") return error("این پرداخت قبلاً تمام شده است.", 409);
  if (payment.gateway_payload?.sandboxResult) return error("برای این پرداخت قبلاً یک دکمه زده شده است.", 409);
  const callbackUrl = String(payment.gateway_payload?.callbackUrl || "");
  if (!callbackUrl) return error("نشانی بازگشت این پرداخت ثبت نشده است.", 409);
  await mergePaymentPayload(payment.id, sandboxAnswer(action));
  const back = new URL(callbackUrl);
  back.searchParams.set("Authority", payment.authority);
  back.searchParams.set("Status", action === "cancel" ? "NOK" : "OK");
  return json({ data: { redirect: back.toString() } });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
