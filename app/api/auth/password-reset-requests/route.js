import { NextResponse } from "next/server";

import { normalizePhone, isValidIranMobile } from "../../../lib/auth.js";
import { requireAdmin } from "../../../lib/admin.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as passwordResetRequests from "../../../lib/db/repos/passwordResetRequests.js";
import { checkIpRateLimit, checkRateLimit } from "../../../lib/rateLimit.js";
import * as users from "../../../lib/db/repos/users.js";
import { readJson, withErrorHandling } from "../../../lib/http.js";
import { smsAdminsSupport } from "../../../lib/adminSms.js";

export const runtime = "nodejs";

// Same shape as register/login's per-phone throttle — this endpoint is
// unauthenticated by nature (that's the whole point: it's for people who
// can't log in), so it's an obvious spam/enumeration target without one.
const REQUEST_LIMIT = 5;
const REQUESTS_PER_IP_HOUR = 20;
const REQUEST_WINDOW_MS = 60 * 60 * 1000;

// No real SMS/OTP provider is wired in yet (deliberately deferred to just
// before public launch — see project notes), so self-service password reset
// isn't possible today. This route only files a manual-recovery request for
// support to answer by texting a new password to that number (support never
// phones anyone); GET/resolve below are gated by a
// shared admin token since there's no admin login system yet either.
async function _POST(request) {
  await ensureDb();
  try {
    const body = (await readJson(request)) || {};
    const phone = normalizePhone(body.phone || "");
    const note = String(body.note || "").slice(0, 300);

    if (!isValidIranMobile(phone)) {
      return NextResponse.json({ error: "شماره موبایلت رو این‌جوری بزن: ۰۹۱۲۳۴۵۶۷۸۹" }, { status: 400 });
    }

    const limited = await checkRateLimit(`password-reset-request:${phone}`, REQUEST_LIMIT, REQUEST_WINDOW_MS);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "زیاد درخواست دادی؛ چند دقیقه دیگه دوباره بزن.", code: "rate_limited" },
        { status: 429 }
      );
    }

    if (!(await checkIpRateLimit(request, "password-reset-request", REQUESTS_PER_IP_HOUR, REQUEST_WINDOW_MS)).ok) {
      return NextResponse.json({ error: "زیاد درخواست دادی؛ چند دقیقه دیگه دوباره بزن.", code: "rate_limited" }, { status: 429 });
    }
    // A number with no account gets the same answer and costs nothing: no queue row, no SMS to the admins.
    if (!(await users.getUserByPhone(phone))) return NextResponse.json({ data: { id: 0 } });
    const result = await passwordResetRequests.createRequest(phone, note);
    smsAdminsSupport("password-reset", { topic: "بازیابی رمز", who: phone });
    return NextResponse.json({ data: { id: result.id } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "درخواستت نرفت؛ چند لحظه دیگه دوباره بزن." }, { status: 500 });
  }
}

async function _GET(request) {
  await ensureDb();
  if (!(await requireAdmin(request)).ok) {
    return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 401 });
  }
  const requests = await passwordResetRequests.listPendingRequests();
  return NextResponse.json({ data: { requests } });
}

export const POST = withErrorHandling(_POST);
export const GET = withErrorHandling(_GET);
