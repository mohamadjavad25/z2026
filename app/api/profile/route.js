import { NextResponse } from "next/server";
import { hashPassword, publicUser, verifyPassword } from "../../lib/auth.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as users from "../../lib/db/repos/users.js";
import { clientErrorResponse, readJson, requireUser, validateBody, withErrorHandling } from "../../lib/http.js";
import { profileUpdateSchema } from "../../lib/validation/user.js";
import { isImageDataUrlTooLarge, isImageDataUrlInvalidType } from "../../lib/mediaLimits.js";
import { isValidIranMobile } from "../../lib/auth.js";
import { phoneChangePurpose, verifyOtpProof } from "../../lib/otp.js";
import { hasUniqueName, nameKey, NAME_TAKEN_MESSAGE } from "../../lib/businessName.js";

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
    const body = (await readJson(request)) || {};

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
      geo: data.geo,
      addressDetail: data.addressDetail,
      service: data.service,
      email: data.email,
      avatar: data.avatar,
      poster: data.poster,
      avatarPosition: data.avatarPosition,
      posterPosition: data.posterPosition,
      experienceYears: data.experienceYears,
      managerName: data.managerName
    };

    // A new phone number must be proven with an SMS code first (POST /api/auth/otp/send + /verify, purpose
    // "phone_change"): the number is how bookings made for it are matched to an account, and where a salon's
    // booking SMS goes, so nobody may point their account at a number they have not shown they own.
    const phoneChanging = data.phone !== undefined && data.phone !== auth.user.phone;
    if (phoneChanging) {
      if (!isValidIranMobile(data.phone)) return NextResponse.json({ error: "شماره موبایل نامعتبر است." }, { status: 400 });
      if (!verifyOtpProof(data.phoneProof, data.phone, phoneChangePurpose(auth.user.id))) {
        return NextResponse.json({ error: "برای تغییر شماره، اول کد پیامک‌شده به شماره جدید را وارد کن.", code: "phone_proof_required" }, { status: 400 });
      }
      if (await users.getUserByPhone(data.phone)) {
        return NextResponse.json({ error: "این شماره برای حساب دیگری ثبت شده است.", code: "phone_taken" }, { status: 409 });
      }
      patch.phoneVerified = true;
    }

    // A salon or artist renaming itself may not take another one's name; an unchanged name (even an old
    // duplicate from before the rule) always saves.
    // The check and the rename happen under one lock, so two accounts cannot both take a free name at the same moment.
    if (hasUniqueName(auth.user.type) && data.name !== undefined && nameKey(data.name) !== nameKey(auth.user.name)) {
      if (!(await users.renameBusiness(auth.user.id, data.name))) {
        return NextResponse.json({ error: NAME_TAKEN_MESSAGE, code: "name_taken" }, { status: 409 });
      }
    }

    // Clients have no field of activity.
    if (auth.user.type === "client") delete patch.service;

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
    // Two accounts proving the same new number at the same moment: the database's unique number wins.
    if (error?.code === "23505" && /phone/i.test(String(error?.constraint || error?.detail || ""))) {
      return NextResponse.json({ error: "این شماره برای حساب دیگری ثبت شده است.", code: "phone_taken" }, { status: 409 });
    }
    const badInput = clientErrorResponse(error);
    if (badInput) return badInput;
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
  const body = (await readJson(request)) || {};
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  if (!currentPassword) {
    return NextResponse.json({ error: "برای حذف حساب، رمز عبور فعلی را وارد کن." }, { status: 400 });
  }
  if (!verifyPassword(currentPassword, auth.user.password_hash)) {
    return NextResponse.json({ error: "رمز فعلی نادرست است." }, { status: 400 });
  }
  // Soft approach: delete user cascades via FK
  // The account's phone number is cut off its old bookings first (a later holder of the number must see none of them).
  await users.deleteUserDetachingPhone(auth.user.id);
  return NextResponse.json({ data: { user: null } });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
export const DELETE = withErrorHandling(_DELETE);
