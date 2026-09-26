import { NextResponse } from "next/server";
import { hashPassword, normalizeDigits } from "../../../../../lib/auth.js";
import { ensureDb } from "../../../../../lib/db/connection.js";
import * as passwordResetRequests from "../../../../../lib/db/repos/passwordResetRequests.js";
import * as users from "../../../../../lib/db/repos/users.js";

export const runtime = "nodejs";

function isAdminAuthorized(request) {
  const token = process.env.ZIBABAN_ADMIN_TOKEN || "";
  if (!token) return false;
  return request.headers.get("x-admin-token") === token;
}

// Admin (founder/support) calls this after phoning the requester back and
// confirming their identity out-of-band, then sets the new password they
// agreed on. There is no self-service path here on purpose — see the create
// route's comment on why (no SMS/OTP provider yet).
export async function POST(request, { params }) {
  await ensureDb();
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 401 });
  }

  const { id } = await params;
  const resetRequest = await passwordResetRequests.getRequestById(id);
  if (!resetRequest) {
    return NextResponse.json({ error: "درخواست پیدا نشد." }, { status: 404 });
  }

  const body = await request.json();
  const newPassword = normalizeDigits(String(body.newPassword || ""));
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "رمز عبور جدید باید حداقل ۸ کاراکتر باشد." }, { status: 400 });
  }

  const user = await users.getUserByPhone(resetRequest.phone);
  if (!user) {
    return NextResponse.json({ error: "حسابی با این شماره پیدا نشد." }, { status: 404 });
  }

  await users.updateUser(user.id, { password_hash: hashPassword(newPassword) });
  await passwordResetRequests.markResolved(id);

  return NextResponse.json({ data: { ok: true } });
}
