import { NextResponse } from "next/server";
import { verifyCronSecret } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { sweepBookingReminders } from "../../../lib/bookingReminders.js";
import { withErrorHandling } from "../../../lib/http.js";

export const runtime = "nodejs";

/** Called by the scheduler every ~10 minutes (CRON_SECRET bearer, same as expire-bookings). */
async function _POST(request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 401 });
  }
  await ensureDb();
  // Test hook, same idea as FRFRO_BOOKING_REQUEST_TIMEOUT_MINUTES: lets an isolated test pin the clock.
  let now = new Date();
  if (process.env.FRFRO_REMINDER_TEST_CLOCK === "1") {
    const body = await request.json().catch(() => ({}));
    if (body?.now) now = new Date(body.now);
  }
  return NextResponse.json({ data: await sweepBookingReminders(now) });
}

export const POST = withErrorHandling(_POST);
