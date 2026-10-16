import { json, notFound, parseId, requireUser, withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { canSeePayment, getPayment } from "../../../../lib/db/repos/billing.js";
import { presentPayment, refreshIfPending } from "../../../../lib/billing/service.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One receipt, only for the account it is for and the one who paid it. A payment still being checked is asked about again (at most every few
 * seconds), so the app's «در حال بررسی» screen turns into the result as soon as the gateway knows.
 */
async function _GET(request, { params }) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  const payment = id ? await getPayment(id) : null;
  if (!canSeePayment(payment, auth.user.id)) return notFound("این پرداخت پیدا نشد.");
  return json({ data: { payment: presentPayment(await refreshIfPending(payment), { viewerId: auth.user.id }) } });
}

export const GET = withErrorHandling(_GET);
