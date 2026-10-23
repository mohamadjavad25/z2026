import { json, notFound, withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { clientIp } from "../../../../lib/adminAuth.js";
import { checkRateLimit } from "../../../../lib/rateLimit.js";
import { getPaymentByToken } from "../../../../lib/db/repos/billing.js";
import { presentPayment, refreshIfPending } from "../../../../lib/billing/service.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The result page after the bank (/pay/<token>) reads this. No login: the long random token in the address is the
 * key, and the answer holds no phone number or name, only what the payer needs to see on that page.
 */
async function _GET(request, { params }) {
  await ensureDb();
  const limited = await checkRateLimit(`billing-return:${clientIp(request)}`, 120, 60_000);
  if (!limited.ok) return json({ error: "درخواست‌های زیاد. چند لحظه صبر کن." }, { status: 429 });
  const payment = await getPaymentByToken((await params).token);
  if (!payment) return notFound("این پرداخت رو پیدا نکردیم.");
  const current = presentPayment(await refreshIfPending(payment));
  return json({
    data: {
      payment: {
        id: current.id,
        status: current.status,
        title: current.title,
        amountToman: current.amountToman,
        receiptNo: current.receiptNo,
        refId: current.refId,
        periodEnd: current.periodEnd,
        paidAt: current.paidAt,
        failure: current.failure,
        sandbox: current.sandbox
      }
    }
  });
}

export const GET = withErrorHandling(_GET);
