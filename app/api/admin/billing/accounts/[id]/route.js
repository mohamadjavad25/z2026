import { error, json, parseId, withErrorHandling } from "../../../../../lib/http.js";
import { ensureDb } from "../../../../../lib/db/connection.js";
import { requireAdmin } from "../../../../../lib/admin.js";
import * as billing from "../../../../../lib/db/repos/billing.js";
import { presentAccount, presentPayment } from "../../../../../lib/billing/service.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The subscription block of a user's admin panel: state now and their payments. { account: null } for a client. */
async function _GET(request, { params }) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const id = parseId((await params).id);
  if (!id) return error("حساب نامعتبر است.", 400);
  const state = await billing.getAccountState(id);
  if (!state) return json({ data: { account: null, payments: [] } });
  const list = await billing.listPayments({ userId: id, limit: 20 });
  return json({ data: { account: presentAccount(state), enabled: state.settings.enabled, payments: list.rows.map((row) => presentPayment(row, { admin: true })) } });
}

export const GET = withErrorHandling(_GET);
