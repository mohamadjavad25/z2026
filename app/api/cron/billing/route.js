import { NextResponse } from "next/server";
import { verifyCronSecret } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { sweepBilling } from "../../../lib/billing/service.js";
import { withErrorHandling } from "../../../lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Called hourly by the scheduler (.github/workflows/cron-billing.yml, CRON_SECRET bearer like the other cron routes):
 * re-checks pending payments, closes abandoned ones, sends subscription reminders.
 */
async function _POST(request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 401 });
  }
  await ensureDb();
  // Same test hook as /api/cron/send-reminders: an isolated test may pin the clock.
  let now = new Date();
  if (process.env.FRFRO_REMINDER_TEST_CLOCK === "1") {
    const body = await request.json().catch(() => ({}));
    if (body?.now) now = new Date(body.now);
  }
  return NextResponse.json({ data: await sweepBilling(now) });
}

export const POST = withErrorHandling(_POST);
