import { NextResponse } from "next/server";
import { withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { clientIp } from "../../../../lib/adminAuth.js";
import { checkRateLimit } from "../../../../lib/rateLimit.js";
import { handleCallback, publicOrigin } from "../../../../lib/billing/service.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where the gateway sends the payer back (GET for most gateways, a posted form for some bank gateways). No login is
 * needed: in the Android app the bank opens in the phone's browser, which has no session. The payment is found by
 * ?pid plus the gateway's own token, verified with the gateway, and the payer lands on /pay/<token> (a page that
 * shows the result without a login). 303 turns a posted form into a plain page load.
 */
async function readParams(request) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  if (request.method === "POST") {
    const type = request.headers.get("content-type") || "";
    try {
      if (type.includes("application/json")) Object.assign(params, await request.json());
      else Object.assign(params, Object.fromEntries((await request.formData()).entries()));
    } catch {
      // an empty or broken body: the query string alone decides
    }
  }
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]));
}

async function handle(request, { params }) {
  await ensureDb();
  const origin = publicOrigin(request);
  const limited = await checkRateLimit(`billing-callback:${clientIp(request)}`, 60, 60_000);
  if (!limited.ok) return NextResponse.redirect(`${origin}/pay/invalid`, 303);
  const { gateway } = await params;
  const values = await readParams(request);
  const pid = Number(values.pid);
  const payment = Number.isSafeInteger(pid) && pid > 0 ? await handleCallback(gateway, pid, values) : null;
  const target = payment?.return_token ? `/pay/${payment.return_token}` : "/pay/invalid";
  return NextResponse.redirect(`${origin}${target}`, { status: 303, headers: { "Cache-Control": "no-store" } });
}

export const GET = withErrorHandling(handle);
export const POST = withErrorHandling(handle);
