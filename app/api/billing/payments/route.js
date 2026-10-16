import { json, requireUser, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { listUserPayments } from "../../../lib/db/repos/billing.js";
import { presentPayment } from "../../../lib/billing/service.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** «پرداخت‌های من»: the signed-in account's payments, newest first. */
async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const rows = await listUserPayments(auth.user.id, 50);
  return json({ data: { payments: rows.map((row) => presentPayment(row)) } });
}

export const GET = withErrorHandling(_GET);
