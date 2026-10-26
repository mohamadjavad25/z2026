import { NextResponse } from "next/server";
import { requireUser, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as users from "../../../lib/db/repos/users.js";

export const runtime = "nodejs";

/**
 * POST /api/customers/hide { bookingIds } -- «از لیست مشتری‌هام بردار»: the salon or artist takes a customer with no
 * number (a deleted account or a walk-in) off its customers page. The bookings themselves stay.
 */
async function _POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { type } = auth.user;
  if (type !== "salon" && type !== "artist") {
    return NextResponse.json({ error: "این کار فقط برای سالن و آرتیسته." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const hidden = await users.hideCustomerBookings(auth.user, body?.bookingIds);
  return NextResponse.json({ data: { hidden } });
}

export const POST = withErrorHandling(_POST);
