import { NextResponse } from "next/server";
import { hashPassword, normalizeDigits } from "../../../../../lib/auth.js";
import { requireAdmin, requireStepUp } from "../../../../../lib/admin.js";
import * as adminRepo from "../../../../../lib/db/repos/admin.js";
import { ensureDb } from "../../../../../lib/db/connection.js";
import * as passwordResetRequests from "../../../../../lib/db/repos/passwordResetRequests.js";
import * as users from "../../../../../lib/db/repos/users.js";
import { deleteUserSessions } from "../../../../../lib/db/repos/sessions.js";
import { withErrorHandling } from "../../../../../lib/http.js";

export const runtime = "nodejs";

// Admin (founder/support) calls this after phoning the requester back and
// confirming their identity out-of-band, then sets the new password they
// agreed on. There is no self-service path here on purpose — see the create
// route's comment on why (no SMS/OTP provider yet).
async function _POST(request, { params }) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) {
    return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 401 });
  }
  // Setting someone's password is a dangerous action: a logged-in admin must have re-typed their password recently (the legacy token path is exempt).
  if (gate.admin.id !== null) {
    const stepUp = requireStepUp(gate);
    if (stepUp) return stepUp;
  }

  const { id } = await params;
  const resetRequest = await passwordResetRequests.getRequestById(id);
  if (!resetRequest) {
    return NextResponse.json({ error: "درخواست پیدا نشد." }, { status: 404 });
  }

  const body = await request.json();
  const newPassword = normalizeDigits(String(body.newPassword || ""));
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "رمز تازه دست‌کم ۸ حرف باشه." }, { status: 400 });
  }

  const user = await users.getUserByPhone(resetRequest.phone);
  if (!user) {
    return NextResponse.json({ error: "با این شماره حسابی نداری." }, { status: 404 });
  }

  await users.updateUser(user.id, { password_hash: hashPassword(newPassword) });
  // A password set for the user signs them out everywhere (owner's decision of 2026-10-25).
  await deleteUserSessions(user.id);
  await passwordResetRequests.markResolved(id);
  await adminRepo.logAction({ adminLabel: gate.admin.label, action: "resolve_password_reset", targetUserId: user.id });

  return NextResponse.json({ data: { ok: true } });
}

export const POST = withErrorHandling(_POST);
