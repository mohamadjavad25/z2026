import { NextResponse } from "next/server";
import { hashPassword, publicUser, verifyPassword } from "../../lib/auth.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as users from "../../lib/db/repos/users.js";
import { deleteProviderAccount } from "../../lib/db/repos/providerExit.js";
import { exitRefusal } from "../../lib/providerExitResponse.js";
import { clientErrorResponse, readJson, requireUser, validateBody, withErrorHandling } from "../../lib/http.js";
import { profileUpdateSchema } from "../../lib/validation/user.js";
import { isImageDataUrlTooLarge, isImageDataUrlInvalidType } from "../../lib/mediaLimits.js";
import { getSessionToken, isValidIranMobile } from "../../lib/auth.js";
import { deleteOtherUserSessions } from "../../lib/db/repos/sessions.js";
import { sendTemplateSms } from "../../lib/sms.js";
import { toLatinDigits } from "../../shared/lib/digits.js";
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
      return NextResponse.json({ error: "عکس بزرگ‌تر از ۵ مگابایته؛ یه عکس کوچیک‌تر بذار." }, { status: 413 });
    }
    if (isImageDataUrlInvalidType(data.avatar) || isImageDataUrlInvalidType(data.poster)) {
      return NextResponse.json({ error: "این نوع عکس رو نمی‌شناسیم؛ JPG یا PNG بذار." }, { status: 400 });
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
      if (!isValidIranMobile(data.phone)) return NextResponse.json({ error: "شماره موبایل درست نیست؛ این‌جوری بزن: ۰۹۱۲…" }, { status: 400 });
      if (!verifyOtpProof(data.phoneProof, data.phone, phoneChangePurpose(auth.user.id))) {
        return NextResponse.json({ error: "برای عوض کردن شماره، اول کدی که به شماره‌ی تازه اومد رو بزن.", code: "phone_proof_required" }, { status: 400 });
      }
      if (await users.getUserByPhone(data.phone)) {
        return NextResponse.json({ error: "این شماره مال یه حساب دیگه‌ست.", code: "phone_taken" }, { status: 409 });
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
        return NextResponse.json({ error: "برای عوض کردن رمز، رمز فعلیت رو بزن." }, { status: 400 });
      }
      if (!verifyPassword(data.currentPassword, auth.user.password_hash)) {
        return NextResponse.json({ error: "رمز فعلی اشتباهه." }, { status: 400 });
      }
      patch.password_hash = hashPassword(data.password);
    }

    // The walk-ins typed for the old number until now stay with this account (owner's decision of 2026-10-25).
    if (phoneChanging) await users.lockOldNumberBookings(auth.user.id);
    const user = await users.updateUser(auth.user.id, patch);
    // A new password or number signs the account out everywhere but here (owner's decision of 2026-10-25); the old
    // number is told, so a change someone else made is noticed (sent only once its pattern is approved).
    if (data.password || phoneChanging) await deleteOtherUserSessions(auth.user.id, getSessionToken(request));
    if (phoneChanging) {
      const tail = toLatinDigits(String(data.phone)).slice(-4);
      void sendTemplateSms(auth.user.phone, "phone_changed", { tail }, "phone_changed").catch(() => {});
    }
    return NextResponse.json({ data: { user: publicUser(user) } });
  } catch (error) {
    // Two accounts proving the same new number at the same moment: the database's unique number wins.
    if (error?.code === "23505" && /phone/i.test(String(error?.constraint || error?.detail || ""))) {
      return NextResponse.json({ error: "این شماره مال یه حساب دیگه‌ست.", code: "phone_taken" }, { status: 409 });
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
    return NextResponse.json({ error: "برای پاک کردن حساب، رمزت رو بزن." }, { status: 400 });
  }
  if (!verifyPassword(currentPassword, auth.user.password_hash)) {
    return NextResponse.json({ error: "رمز فعلی اشتباهه." }, { status: 400 });
  }
  // A salon or artist is never deleted while a confirmed booking starts within 24 hours; farther confirmed bookings are
  // cancelled one by one or all together with notice (owner's rules of 2026-10-22, providerExit.js). A client is held by the same rule from their side (clientExit.js, 2026-10-26).
  // The account's phone number is cut off its old bookings first (a later holder of the number must see none of them).
  const result = await deleteProviderAccount({ user: auth.user, cancelAll: body?.cancelAll === true });
  if (!result.ok) return exitRefusal(result, { scope: "account" });
  return NextResponse.json({ data: { user: null } });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
export const DELETE = withErrorHandling(_DELETE);
