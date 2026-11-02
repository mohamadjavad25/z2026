import { error, json, parseId, readObjectBody, requireUser, withErrorHandling } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import { checkRateLimit } from "../../lib/rateLimit.js";
import { joinWaitlist } from "../../lib/waitlist.js";
import { deleteWaitlistEntry, listClientWaitlist, WAITLIST_MAX_ACTIVE } from "../../lib/db/repos/waitlist.js";
import { strictDayKey } from "../../lib/validation/bookingSlot.js";
import { toPersianDigits } from "../../shared/lib/digits.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGES = {
  owner: ["این‌جا الان نوبت آنلاین نمی‌گیره.", 409],
  day: ["این روز رو نمی‌شه؛ یه روز از امروز تا دو ماه دیگه انتخاب کن.", 400],
  services: ["کارها درست نرسید؛ دوباره انتخاب کن.", 400],
  too_many: [`همین الان منتظر ${toPersianDigits(WAITLIST_MAX_ACTIVE)} تا جا هستی؛ یکی رو بردار، بعد این رو بزن.`, 409]
};

async function clientOnly(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return { response: auth.response };
  if (auth.user.type !== "client") return { response: error("«خبرم کن» مال مشتریه.", 403) };
  return { user: auth.user };
}

/** GET /api/waitlist → the client's «خبرم کن» entries from today on. */
async function _GET(request) {
  const { user, response } = await clientOnly(request);
  if (response) return response;
  return json({ data: { entries: await listClientWaitlist(user.id) } });
}

/** POST /api/waitlist { kind: "salon" | "artist", ownerId, day, services: [{ name, minutes }] } */
async function _POST(request) {
  const { user, response } = await clientOnly(request);
  if (response) return response;
  const limited = await checkRateLimit(`waitlist-join:${user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) return error("یه کم زیاد زدی؛ چند لحظه دیگه دوباره بزن.", 429);
  const body = await readObjectBody(request);
  const kind = body.kind === "artist" ? "artist" : "salon";
  const ownerUserId = parseId(body.ownerId);
  if (!ownerUserId) return error("این‌جا رو پیدا نکردیم.", 400);
  const bookingDate = strictDayKey(body.day);
  const result = await joinWaitlist({ client: user, kind, ownerUserId, bookingDate, services: body.services });
  if (!result.ok) {
    const [message, status] = MESSAGES[result.error] || ["نشد؛ دوباره بزن.", 409];
    return error(message, status);
  }
  return json({ data: { entry: result.entry, freeNow: result.freeNow, entries: await listClientWaitlist(user.id) } }, { status: 201 });
}

/** DELETE /api/waitlist?id= */
async function _DELETE(request) {
  const { user, response } = await clientOnly(request);
  if (response) return response;
  const id = parseId(new URL(request.url).searchParams.get("id"));
  if (!id) return error("این مورد رو پیدا نکردیم.", 400);
  await deleteWaitlistEntry(user.id, id);
  return json({ data: { entries: await listClientWaitlist(user.id) } });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
export const DELETE = withErrorHandling(_DELETE);
