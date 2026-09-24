import { NextResponse } from "next/server";

import { normalizePhone, isValidIranMobile } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as passwordResetRequests from "../../../lib/db/repos/passwordResetRequests.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";

export const runtime = "nodejs";

// Same shape as register/login's per-phone throttle — this endpoint is
// unauthenticated by nature (that's the whole point: it's for people who
// can't log in), so it's an obvious spam/enumeration target without one.
const REQUEST_LIMIT = 5;
const REQUEST_WINDOW_MS = 60 * 60 * 1000;

// No real SMS/OTP provider is wired in yet (deliberately deferred to just
// before public launch — see project notes), so self-service password reset
// isn't possible today. This route only files a manual-recovery request for
// the founder/support to act on by phone; GET/resolve below are gated by a
// shared admin token since there's no admin login system yet either.
export async function POST(request) {
  ensureDb();
  try {
    const body = await request.json();
    const phone = normalizePhone(body.phone || "");
    const note = String(body.note || "").slice(0, 300);

    if (!isValidIranMobile(phone)) {
      return NextResponse.json({ error: "شماره تماس باید یک شماره موبایل معتبر ایران باشد." }, { status: 400 });
    }

    const limited = checkRateLimit(`password-reset-request:${phone}`, REQUEST_LIMIT, REQUEST_WINDOW_MS);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "درخواست‌های زیادی ثبت شده. کمی بعد دوباره امتحان کن.", code: "rate_limited" },
        { status: 429 }
      );
    }

    const result = passwordResetRequests.createRequest(phone, note);
    return NextResponse.json({ data: { id: result.id } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "ثبت درخواست انجام نشد." }, { status: 500 });
  }
}

function isAdminAuthorized(request) {
  const token = process.env.ZIBABAN_ADMIN_TOKEN || "";
  if (!token) return false;
  return request.headers.get("x-admin-token") === token;
}

export async function GET(request) {
  ensureDb();
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 401 });
  }
  const requests = passwordResetRequests.listPendingRequests();
  return NextResponse.json({ data: { requests } });
}
