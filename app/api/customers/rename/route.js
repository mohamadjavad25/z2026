import { NextResponse } from "next/server";
import { requireUser, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as users from "../../../lib/db/repos/users.js";
import { phoneLast10 } from "../../../shared/lib/phone.js";

export const runtime = "nodejs";

/**
 * POST /api/customers/rename { phone, name } -- «اسم رو عوض کن»: the salon or artist, asked "this number is saved as
 * «سارا»; you typed «مریم»", chose to call the person «مریم» everywhere. Only the owner's own bookings for that number
 * change, never one tied to a frfro account (users.renameCustomerBookings).
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
  const name = String(body?.name || "").trim();
  if (!name || name.length > 80 || phoneLast10(body?.phone).length < 10) {
    return NextResponse.json({ error: "اسم و شماره رو درست بزن." }, { status: 400 });
  }
  const renamed = await users.renameCustomerBookings(auth.user, body.phone, name);
  return NextResponse.json({ data: { renamed } });
}

export const POST = withErrorHandling(_POST);
