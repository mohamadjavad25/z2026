import { NextResponse } from "next/server";
import { verifyCronSecret } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { sweepExpiredBookingRequestsOnce } from "../../../lib/bookingExpirySweep.js";
import { withErrorHandling } from "../../../lib/http.js";

export const runtime = "nodejs";

/**
 * Replaces the old self-starting in-process setInterval sweep (see git
 * history / docs/DEVLOG.md) -- unreliable under this app's actual Vercel
 * serverless deployment model, where function instances are ephemeral and
 * scale to zero, so an in-memory timer has no guarantee of ever firing
 * again after a cold start. An external scheduler (Supabase pg_cron via
 * `net.http_post`, or any other scheduler -- Vercel Cron if/when this
 * project actually has a Vercel deployment to configure) calls this
 * endpoint on a fixed interval instead; see RECOMMENDED_SWEEP_INTERVAL_MS
 * in bookingExpirySweep.js for the recommended schedule and
 * CRON_SECRET in .env.example for how the call is authenticated.
 */
async function _POST(request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 401 });
  }
  await ensureDb();
  const result = await sweepExpiredBookingRequestsOnce();
  return NextResponse.json({ data: result });
}

export const POST = withErrorHandling(_POST);
