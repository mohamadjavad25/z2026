import { error, json, readJson, requireUser, validateBody, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";
import { checkoutSchema } from "../../../lib/validation/billing.js";
import { publicOrigin, startCheckout, startPackCheckout } from "../../../lib/billing/service.js";
import { isBilledRole } from "../../../lib/billing/plans.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { plan, forUserId? } or { pack }: starts paying for a plan or an SMS pack. Answers { paymentId, redirect: { method,
 * url, fields? } }; the app keeps the payment id and sends the payer to `redirect`. The amount comes from the plan or
 * pack on the server, never from the body. forUserId: a salon paying for an artist on its own team (checked on the server).
 */
async function _POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (!isBilledRole(auth.user.type)) return error("اشتراک مال سالن و آرتیسته؛ مشتری‌ها رایگانن.", 403);
  const limited = await checkRateLimit(`billing-checkout:${auth.user.id}`, 8, 10 * 60_000);
  if (!limited.ok) return error("چند بار پشت سر هم زدی؛ چند دقیقه صبر کن و دوباره بزن.", 429);
  const valid = validateBody(checkoutSchema, (await readJson(request)) || {});
  if (!valid.ok) return valid.response;
  const origin = publicOrigin(request);
  const result = valid.data.pack
    ? await startPackCheckout({ user: auth.user, packId: valid.data.pack, origin })
    : await startCheckout({ user: auth.user, planId: valid.data.plan, forUserId: valid.data.forUserId || null, origin });
  if (!result.ok) return json({ error: result.error, code: result.code }, { status: result.status });
  return json({ data: { paymentId: result.paymentId, redirect: result.redirect } }, { status: 201 });
}

export const POST = withErrorHandling(_POST);
