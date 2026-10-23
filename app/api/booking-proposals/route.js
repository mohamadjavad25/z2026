import { error, json, parseId, readObjectBody, requireUser, withErrorHandling } from "../../lib/http.js";
import * as salons from "../../lib/db/repos/salons.js";
import * as artists from "../../lib/db/repos/artists.js";
import * as proposals from "../../lib/db/repos/bookingProposals.js";
import { getUserLiteById } from "../../lib/db/repos/users.js";
import { all, getDb } from "../../lib/db/connection.js";
import { checkRateLimit } from "../../lib/rateLimit.js";
import { noticeClientHandoverProposal, noticeClientTimeProposal } from "../../lib/providerNotices.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS = { missing: 404, not_confirmed: 409, no_account: 409, too_late: 409, slot: 409, same: 400, staff: 409, changed: 409 };

/**
 * POST /api/booking-proposals (a salon or artist): «پیشنهاد ساعت دیگر» / «واگذار به آرتیست دیگر» for a CONFIRMED booking.
 *   { kind: "salon", id, date?, time }            the salon proposes another time (its own booking)
 *   { kind: "artist", id, date?, time }           an independent artist proposes another time (a direct booking)
 *   { kind: "salon", id, toStaff, salonUserId?, fromStaffId? }   another artist takes the parts of a team member who leaves;
 *        asked by the salon (fromStaffId = the member's staff row) or by the leaving artist (salonUserId)
 * The booking is not changed: its original time and artist stay valid until the client accepts
 * (POST /api/booking-proposals/answer). The client gets a push, an in-app card and an SMS.
 */
async function _POST(request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (!["salon", "artist"].includes(auth.user.type)) return error("فقط سالن یا آرتیست.", 403);
  const limited = await checkRateLimit(`booking-proposal:${auth.user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) return error("پیشنهادهای زیاد. کمی بعد دوباره امتحان کن.", 429);
  const body = await readObjectBody(request);
  const id = parseId(body.id);
  const kind = body.kind === "artist" ? "artist" : "salon";
  if (!id) return error("شناسه رزرو نامعتبر است.", 400);
  const toStaff = typeof body.toStaff === "string" ? body.toStaff.trim() : "";
  const date = typeof body.date === "string" ? body.date : "";
  const time = typeof body.time === "string" ? body.time : "";
  if (!toStaff && !time) return error("ساعت پیشنهادی مشخص نیست.", 400);

  let result;
  let providerForClient;
  let providerUserId = auth.user.id;
  if (kind === "artist") {
    if (auth.user.type !== "artist" || toStaff) return error("دسترسی غیرمجاز.", 403);
    result = await proposals.proposeArtistTime({ artistUserId: auth.user.id, id, date, time });
    providerForClient = { type: "artist", name: auth.user.name };
  } else if (toStaff) {
    // Another artist takes over: asked by the salon (naming the member who leaves) or by that artist.
    const db = await getDb();
    let salonUserId = auth.user.id;
    let fromNames;
    let actorArtistId = null;
    if (auth.user.type === "salon") {
      const fromStaffId = parseId(body.fromStaffId);
      if (!fromStaffId) return error("آرتیستی که می‌رود مشخص نیست.", 400);
      fromNames = (await all(db, "SELECT name FROM salon_staff WHERE id = $1 AND salon_user_id = $2", [fromStaffId, salonUserId])).map((row) => row.name);
    } else {
      salonUserId = parseId(body.salonUserId);
      if (!salonUserId) return error("سالن مشخص نیست.", 400);
      fromNames = (await all(db, "SELECT name FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2", [salonUserId, auth.user.id])).map((row) => row.name);
      actorArtistId = auth.user.id;
    }
    if (!fromNames.length) return error("این آرتیست عضو تیم این سالن نیست.", 404);
    result = await proposals.proposeSalonHandover({ salonUserId, id, toStaff, fromNames, actorArtistId });
    const salon = await getUserLiteById(salonUserId);
    providerForClient = { type: "salon", name: salon?.name || "" };
    providerUserId = salonUserId;
  } else {
    if (auth.user.type !== "salon") return error("دسترسی غیرمجاز.", 403);
    result = await proposals.proposeSalonTime({ salonUserId: auth.user.id, id, date, time });
    providerForClient = { type: "salon", name: auth.user.name };
  }
  if (!result.ok) return json({ error: result.message, code: result.error.toUpperCase(), ...(result.phone ? { data: { phone: result.phone } } : {}) }, { status: STATUS[result.error] || 409 });

  const booking = { ...result.booking, kind: result.kind };
  const clientUserId = Number(result.booking.client_user_id || 0);
  if (toStaff) noticeClientHandoverProposal(clientUserId, { provider: providerForClient, booking, fromStaff: result.fromStaff, toStaff: result.toStaff });
  else noticeClientTimeProposal(clientUserId, { provider: providerForClient, booking, toDate: result.toDate, toTime: result.toTime });
  void providerUserId;
  return json({
    data: {
      booking: result.booking,
      bookings: auth.user.type === "salon" ? await salons.listSalonBookings(auth.user.id) : await artists.listArtistBookings(auth.user.id)
    }
  });
}

/** DELETE /api/booking-proposals { kind, id } — the provider takes its proposal back; the booking stays as it was. */
async function _DELETE(request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (!["salon", "artist"].includes(auth.user.type)) return error("فقط سالن یا آرتیست.", 403);
  const body = await readObjectBody(request);
  const id = parseId(body.id);
  if (!id) return error("شناسه رزرو نامعتبر است.", 400);
  const kind = auth.user.type === "artist" && body.kind === "artist" ? "artist" : "salon";
  const result = await proposals.withdrawProposal({ kind, id, providerUserId: auth.user.id });
  if (!result.ok) return error(result.message, STATUS[result.error] || 409);
  return json({
    data: {
      booking: result.booking,
      bookings: auth.user.type === "salon" ? await salons.listSalonBookings(auth.user.id) : await artists.listArtistBookings(auth.user.id)
    }
  });
}

export const POST = withErrorHandling(_POST);
export const DELETE = withErrorHandling(_DELETE);
