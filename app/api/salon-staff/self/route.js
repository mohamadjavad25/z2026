import { json, requireUserRole, withErrorHandling } from "../../../lib/http.js";
import * as salons from "../../../lib/db/repos/salons.js";
import { isImageDataUrlInvalidType, isImageDataUrlTooLarge } from "../../../lib/mediaLimits.js";

export const runtime = "nodejs";

/**
 * The salon manager working on their own team.
 * GET → { profile }: what they entered before (kept after they leave the team) and the photos to pick from.
 * POST { name?, role?, photo? } → { person, staff, profile }: joins (or updates) the team as a member flagged
 * is_owner. Fields left out come from the saved profile, so an empty POST rejoins with one tap. photo is
 * "salon", "own" or a new image data URL. From then on they are picked for services and bookings like any
 * other member. Leaving the team is the usual DELETE /api/salon-staff with that member's id.
 */
async function _GET(request) {
  const auth = await requireUserRole(request, "salon", "این بخش مال سالن‌هاست.");
  if (!auth.ok) return auth.response;
  return json({ data: { profile: await salons.getSalonOwnerProfile(auth.user.id) } });
}

async function _POST(request) {
  const auth = await requireUserRole(request, "salon", "این بخش مال سالن‌هاست.");
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const photo = body?.photo == null ? undefined : String(body.photo);
  if (photo !== undefined && photo !== "salon" && photo !== "own") {
    if (!photo.startsWith("data:") || isImageDataUrlInvalidType(photo)) {
      return json({ error: "این فایل عکس نیست؛ یه عکس دیگه انتخاب کن." }, { status: 400 });
    }
    if (isImageDataUrlTooLarge(photo)) {
      return json({ error: "عکس خیلی بزرگه؛ یه عکس کوچیک‌تر انتخاب کن." }, { status: 413 });
    }
  }
  const result = await salons.upsertSalonOwnerStaff(auth.user.id, {
    name: body?.name == null ? "" : String(body.name),
    role: body?.role == null ? null : String(body.role),
    photo,
    fallbackName: auth.user.manager_name || "مدیر سالن"
  });
  if (!result.ok) return json({ error: result.error }, { status: 409 });
  return json({
    data: {
      person: result.person,
      staff: await salons.listSalonStaff(auth.user.id),
      profile: await salons.getSalonOwnerProfile(auth.user.id)
    }
  });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
