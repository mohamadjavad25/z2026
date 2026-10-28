import { error, json, readObjectBody, requireUserRole, withErrorHandling } from "../../../lib/http.js";
import { planExit, describePlan } from "../../../lib/db/repos/providerExit.js";
import { addLeave, cancelLeave, checkLeave, listLeaves, salonsOfArtist } from "../../../lib/db/repos/teamAgreements.js";
import { notifyConnection } from "../../../lib/connectionNotify.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";
import { formatRelativeBookingDayLabel } from "../../../shared/lib/persianCalendar.js";
import { toPersianDigits } from "../../../shared/lib/digits.js";

export const runtime = "nodejs";

/** «فردا، از ۱۴:۰۰ تا ۱۸:۰۰» / «از امروز تا ۳ روز دیگه». */
function whenText(leave) {
  const from = formatRelativeBookingDayLabel(leave.from);
  const days = leave.to === leave.from ? from : `${from} تا ${formatRelativeBookingDayLabel(leave.to)}`;
  return leave.start ? `${days}، از ${toPersianDigits(leave.start)} تا ${toPersianDigits(leave.end)}` : days;
}

async function tellSalons(artist, leave, kind) {
  for (const { salon_user_id: salonUserId } of await salonsOfArtist(artist.id)) {
    notifyConnection(salonUserId, kind === "added"
      ? { title: `${artist.name || "یکی از تیمت"} نمی‌تونه بیاد`, body: `${whenText(leave)}. نوبت‌های اون وقت رو قبلاً جابه‌جا کرده.`, url: "/" }
      : { title: `${artist.name || "یکی از تیمت"} مرخصی‌ش رو برداشت`, body: `${whenText(leave)} دوباره سر کاره.`, url: "/" });
  }
}

/** GET /api/artist/leaves → { leaves } the artist's upcoming leaves. */
async function _GET(request) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  return json({ data: { leaves: await listLeaves(auth.user.id) } });
}

/**
 * POST /api/artist/leaves { from, to, start, end, note } (date keys; start/end "" = the whole day).
 * Not while a confirmed booking of theirs sits inside it (owner's answer 1, 2026-10-28): 409 with `plan` (the same plan the
 * leave dialog shows: cancel with notice or hand over, booking by booking). The salons they are on the team of are told.
 */
async function _POST(request) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  const limited = await checkRateLimit(`leave:${auth.user.id}`, 20, 60 * 60 * 1000);
  if (!limited.ok) return error("یه کم زیاد مرخصی گذاشتی؛ چند لحظه دیگه دوباره بزن.", 429);
  const body = await readObjectBody(request);
  const checked = checkLeave(body);
  if (!checked.ok) return json({ error: checked.error, code: "INVALID" }, { status: 400 });
  const plan = await describePlan(await planExit({ scope: "leave", user: auth.user, window: checked.value }));
  if (plan.blocked) {
    return json({ error: "تو این وقت‌ها نوبت داری. اول هر نوبت رو به یه آرتیست دیگه بده یا با خبر به مشتری لغو کن.", code: "HAS_BOOKINGS", plan }, { status: 409 });
  }
  const leave = await addLeave(auth.user.id, checked.value);
  await tellSalons(auth.user, leave, "added");
  return json({ data: { leave, leaves: await listLeaves(auth.user.id) } }, { status: 201 });
}

/** DELETE /api/artist/leaves { id } → the artist takes a leave back. */
async function _DELETE(request) {
  const auth = await requireUserRole(request, "artist", "این بخش مال آرتیست‌هاست.");
  if (!auth.ok) return auth.response;
  const body = await readObjectBody(request);
  const leave = await cancelLeave(auth.user.id, Number(body.id));
  if (!leave) return json({ error: "این مرخصی رو پیدا نکردیم.", code: "NOT_FOUND" }, { status: 404 });
  await tellSalons(auth.user, leave, "removed");
  return json({ data: { leaves: await listLeaves(auth.user.id) } });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
export const DELETE = withErrorHandling(_DELETE);
