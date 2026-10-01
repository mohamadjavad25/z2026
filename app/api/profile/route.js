import { NextResponse } from "next/server";
import { hashPassword, publicUser, verifyPassword } from "../../lib/auth.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as users from "../../lib/db/repos/users.js";
import { requireUser, validateBody, withErrorHandling } from "../../lib/http.js";
import { profileUpdateSchema } from "../../lib/validation/user.js";
import { isImageDataUrlTooLarge, isImageDataUrlInvalidType } from "../../lib/mediaLimits.js";

export const runtime = "nodejs";

async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ data: { user: publicUser(auth.user) } });
}

async function _POST(request) {
  await ensureDb();
  try {
    const body = await request.json();

    // Legacy signup path without session → redirect clients to /api/auth/register
    // Keep PATCH-like profile update for logged-in users.
    const auth = await requireUser(request);
    if (!auth.ok) {
      return NextResponse.json(
        { error: "برای ثبت‌نام از /api/auth/register استفاده کن." },
        { status: 401 }
      );
    }

    const rawData = body.data || body;
    const v = validateBody(profileUpdateSchema, rawData);
    if (!v.ok) return v.response;
    const data = v.data;

    if (isImageDataUrlTooLarge(data.avatar) || isImageDataUrlTooLarge(data.poster)) {
      return NextResponse.json({ error: "حجم عکس بیش از حد مجاز (۵ مگابایت) است." }, { status: 413 });
    }
    if (isImageDataUrlInvalidType(data.avatar) || isImageDataUrlInvalidType(data.poster)) {
      return NextResponse.json({ error: "فرمت عکس پشتیبانی نمی‌شود." }, { status: 400 });
    }

    const patch = {
      name: data.name,
      phone: data.phone,
      area: data.area,
      service: data.service,
      email: data.email,
      avatar: data.avatar,
      poster: data.poster,
      avatarPosition: data.avatarPosition,
      posterPosition: data.posterPosition,
      bio: data.bio,
      experienceYears: data.experienceYears,
      managerName: data.managerName
    };

    if (data.password) {
      if (!data.currentPassword) {
        return NextResponse.json({ error: "برای تغییر رمز، رمز فعلی را وارد کن." }, { status: 400 });
      }
      if (!verifyPassword(data.currentPassword, auth.user.password_hash)) {
        return NextResponse.json({ error: "رمز فعلی نادرست است." }, { status: 400 });
      }
      patch.password_hash = hashPassword(data.password);
    }

    const user = await users.updateUser(auth.user.id, patch);
    return NextResponse.json({ data: { user: publicUser(user) } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "ذخیره پروفایل انجام نشد." }, { status: 500 });
  }
}

async function _DELETE(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  // Require re-entering the current password, same bar as the
  // password-change branch of POST /api/profile above -- without this, a
  // stolen/hijacked session cookie alone was enough to permanently delete
  // the account with a single unauthenticated-content-check-only request.
  const body = await request.json().catch(() => ({}));
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  if (!currentPassword) {
    return NextResponse.json({ error: "برای حذف حساب، رمز عبور فعلی را وارد کن." }, { status: 400 });
  }
  if (!verifyPassword(currentPassword, auth.user.password_hash)) {
    return NextResponse.json({ error: "رمز فعلی نادرست است." }, { status: 400 });
  }
  // Soft approach: delete user cascades via FK
  const { getDb, run } = await import("../../lib/db/connection.js");
  await run(await getDb(), "DELETE FROM users WHERE id = $1", [auth.user.id]);
  return NextResponse.json({ data: { user: null } });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
export const DELETE = withErrorHandling(_DELETE);
