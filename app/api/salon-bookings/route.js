import { NextResponse } from "next/server";
import { requireUser, validateBody, withErrorHandling, readObjectBody } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as salons from "../../lib/db/repos/salons.js";
import { checkRateLimit } from "../../lib/rateLimit.js";
import { sendPushToUser } from "../../lib/push.js";
import { createBookingSchema } from "../../lib/validation/booking.js";
// The booking-request expiry sweep, run on demand (at most once a minute) from this app's busiest
// salon-booking entry point (polled by both the salon owner dashboard and the client's own-bookings
// view), so a stale request closes within seconds of real use.
import { sweepExpiredBookingRequestsIfDue } from "../../lib/bookingExpirySweep.js";
import { normalizeBookingTimeLabel } from "../../shared/lib/time.js";
import { readBookingSlot } from "../../lib/validation/bookingSlot.js";
import { bookingMoveOptions } from "../../lib/salonMoveTimes.js";
import { toPersianDigits } from "../../shared/lib/digits.js";
import { AWAITING_CLIENT } from "../../shared/lib/bookingOffer.js";
import { createSalonBooking } from "../../lib/salonBookingCreate.js";
import { requestedServiceNames, validFallbackSalon } from "../../lib/bookingFallback.js";
import { BOOKING_REQUEST_WINDOW_MINUTES } from "../../shared/lib/bookingWindow.js";
import { bookingWhen, smsBookingAnswer, smsNewBookingRequest } from "../../lib/bookingSms.js";
import { notifyStaff } from "../../lib/staffNotify.js";
import { noticeClientCancelledByProvider, noticeClientTimeProposal } from "../../lib/providerNotices.js";
import * as proposals from "../../lib/db/repos/bookingProposals.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreJson(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return NextResponse.json(body, { ...init, headers });
}

function requireSalon(user) {
  if (user.type !== "salon") return noStoreJson({ error: "این بخش مال سالن‌هاست." }, { status: 403 });
  return null;
}

async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  await sweepExpiredBookingRequestsIfDue();
  const { searchParams } = new URL(request.url);
  const requestedSalonId = searchParams.get("salonUserId");
  if (requestedSalonId) {
    const salonUserId = Number(requestedSalonId);
    if (!salonUserId) return noStoreJson({ error: "این سالن رو پیدا نکردیم." }, { status: 400 });
    if (auth.user.type === "salon" && salonUserId === auth.user.id) {
      const bookings = await salons.listSalonBookings(auth.user.id);
      return noStoreJson({ data: { bookings } });
    }
    // Only what another client needs to see: the live bookings of the next few weeks (never the salon's whole
    // history), briefly cached -- every client's booking screen asks for this.
    const hours = await salons.listSalonHours(salonUserId);
    if (!hours.length) return noStoreJson({ error: "این سالن پیدا نشد." }, { status: 404 });
    const unavailableSlots = await salons.listUnavailableSlots(salonUserId);
    return noStoreJson({ data: { unavailableSlots, hours } });
  }
  if (auth.user.type === "client") {
    const bookings = await salons.listClientSalonBookings(auth.user);
    return noStoreJson({ data: { bookings } });
  }
  const forbidden = requireSalon(auth.user);
  if (forbidden) return forbidden;
  const bookings = await salons.listSalonBookings(auth.user.id);
  return noStoreJson({ data: { bookings } });
}

async function _POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  // Per-caller throttle against booking-spam (a client scripting repeated
  // reservation requests, or a compromised session flooding a salon's
  // schedule). Same DB-backed limiter/pattern this codebase already uses for
  // other abuse-prone routes (see /api/auth/login, /api/artist/bookings).
  const bookingLimited = await checkRateLimit(`salon-booking-create:${auth.user.id}`, 20, 60_000);
  if (!bookingLimited.ok) {
    return noStoreJson({ error: "یه کم زیاد زدی؛ چند لحظه صبر کن." }, { status: 429 });
  }

  const body = await readObjectBody(request);
  if (!["client", "salon"].includes(auth.user.type)) {
    return noStoreJson({ error: "فقط مشتری یا سالن می‌تواند رزرو ثبت کند." }, { status: 403 });
  }
  // Validated/stripped body used only for the addSalonBooking() spread
  // below -- zod drops any unlisted key (in particular `status`), so a
  // caller can never self-confirm a booking by including "status": "تایید شده"
  // in the request; every other field on this route still reads from the
  // raw `body` above, unaffected.
  const v = validateBody(createBookingSchema, body);
  if (!v.ok) return v.response;
  const salonUserId = body.salonUserId ? Number(body.salonUserId) : auth.user.id;
  if (!salonUserId) return noStoreJson({ error: "این سالن رو پیدا نکردیم." }, { status: 400 });
  if (auth.user.type === "salon" && salonUserId !== auth.user.id) {
    return noStoreJson({ error: "این کار با حساب تو نمی‌شه." }, { status: 403 });
  }
  // How long the client waits for an answer is their own choice (an hour, or until the appointment);
  // a backup salon only goes with the hour, and only one the client follows that lists these services.
  const isClient = auth.user.type === "client";
  const waitMinutes = isClient && v.data.waitMinutes !== undefined ? v.data.waitMinutes : BOOKING_REQUEST_WINDOW_MINUTES;
  const fallbackSalonUserId = isClient && waitMinutes !== null && v.data.fallbackSalonUserId
    ? await validFallbackSalon(auth.user.id, salonUserId, Number(v.data.fallbackSalonUserId), requestedServiceNames(body, v.data))
    : null;
  const result = await createSalonBooking({
    actor: auth.user,
    salonUserId,
    body,
    data: v.data,
    wait: { minutes: waitMinutes, fallbackSalonUserId }
  });
  // The salon's full list (every customer's name and number) goes back only to the salon itself,
  // never to a client who just sent a request.
  const ownList = !isClient;
  if (!result.ok) {
    return noStoreJson({
      error: result.error,
      ...(result.code ? { code: result.code } : {}),
      ...(result.withBookings && ownList ? { data: { bookings: await salons.listSalonBookings(salonUserId) } } : {})
    }, { status: result.status });
  }
  const { client, service, time, artistBooking, linkedArtistIds } = result;
  // Real-time heads-up for the salon the moment a real client requests a
  // slot, not just whenever they next happen to poll/open the dashboard —
  // only when the CLIENT is the one who just requested it (a salon entering
  // its own walk-in booking doesn't need to be told about its own action).
  // A repeated tap on the same request is answered with the request already made, and the salon is not told twice.
  if (auth.user.type === "client" && !result.duplicate) {
    const push = sendPushToUser(salonUserId, {
      title: "درخواست تازه",
      body: `${client}، ${service}، ${bookingWhen(result.booking.booking_date, time)}`
    }).catch(() => null);
    smsNewBookingRequest(salonUserId, { client, service, bookingDate: result.booking.booking_date, time, fromUserId: auth.user.id }, push);
  }
  // The team artist whose visit it is hears about it too (waiting for the salon's answer, or booked by the salon).
  if (!result.duplicate) {
    notifyStaff({ artistIds: linkedArtistIds, exceptUserId: auth.user.id }, {
      title: auth.user.type === "client" ? "یه درخواست تازه برات توی سالن" : "سالن برات نوبت گذاشت",
      body: `${client}، ${service}، ${bookingWhen(result.booking.booking_date, time)}${auth.user.type === "client" ? "؛ منتظر جواب سالن" : ""}`
    });
  }

  return noStoreJson({
    data: {
      booking: result.booking,
      ...(ownList ? { bookings: await salons.listSalonBookings(salonUserId) } : {}),
      artistBooking,
      linkedArtistId: linkedArtistIds[0] || null,
      linkedArtistIds
    }
  }, { status: result.duplicate ? 200 : 201 });
}

async function _PATCH(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const forbidden = requireSalon(auth.user);
  if (forbidden) return forbidden;
  const body = await readObjectBody(request);
  const id = Number(body.id);
  if (!id) return noStoreJson({ error: "این نوبت رو پیدا نکردیم." }, { status: 400 });

  const wantsCancel = body.status === "لغو" || body.action === "cancel";
  // Whitelist, same shape as patchOwnArtistBooking in /api/artist/me: the only
  // status transitions a salon owner may set through this public route are
  // approve ("تایید شده") and cancel ("لغو"). Every other value — including
  // "منقضی شده", which is sweep-only (bookingExpirySweep.js) and otherwise
  // frees the slot early via the GET unavailableSlots filter — is rejected.
  // Other PATCH fields (time/staff/client/…) never carry a status, so this
  // only fires when the caller explicitly sends one.
  if (!wantsCancel && body.status != null && body.status !== "" && body.status !== "تایید شده") {
    return noStoreJson({ error: "این جواب رو نفهمیدیم؛ دوباره بزن." }, { status: 400 });
  }
  let patch = wantsCancel ? { status: "لغو" } : body;
  // «تقسیم خودکار»: the server re-drafts who does what (suggestBookingStaff) and saves it like
  // any other artist change -- each artist checked free, their calendars updated.
  if (!wantsCancel && body.autoAssign === true) {
    const suggestion = await salons.suggestBookingStaff(id, auth.user.id);
    if (!suggestion) return noStoreJson({ error: "این نوبت رو پیدا نکردیم." }, { status: 404 });
    const anyone = suggestion.parts ? suggestion.parts.some((part) => part.staff) : Boolean(suggestion.staff);
    if (!anyone) {
      return noStoreJson({ error: "در این ساعت آرتیست آزادی برای این نوبت نیست.", code: "NO_FREE_ARTIST" }, { status: 409 });
    }
    patch = suggestion.parts ? { parts: suggestion.parts } : { staff: suggestion.staff };
  }
  // A new day or time is read strictly (a real Jalali day, a real HH:MM), whatever else is edited with it.
  const movesTo = ["time", "booking_date", "bookingDate", "date"].some((key) => body[key] != null);
  if (!wantsCancel && movesTo) {
    const current = await salons.getSalonBookingRow(id, auth.user.id);
    if (!current) return noStoreJson({ error: "این نوبت رو پیدا نکردیم." }, { status: 404 });
    const rawDay = body.booking_date ?? body.bookingDate ?? body.date ?? current.booking_date;
    const rawTime = body.time ?? current.time ?? "";
    const slot = readBookingSlot(typeof rawDay === "string" ? rawDay : "", typeof rawTime === "string" ? rawTime : "");
    if (!slot.ok) return noStoreJson({ error: slot.error }, { status: slot.status });
    // What is saved is the canonical form, never the text as typed.
    patch = { ...patch, bookingDate: slot.dateKey, booking_date: undefined, date: undefined, time: slot.time };
  }
  // A CONFIRMED booking of a client with an account is never moved on the salon's word alone (owner's rule of
  // 2026-10-22): the new time becomes a proposal («پیشنهاد ساعت دیگر»), the original time stays valid until the
  // client accepts. (A walk-in with no account has nobody to ask: it moves as before, the salon calls them.)
  if (!wantsCancel && movesTo && body.staff === undefined && body.parts === undefined) {
    const current = await salons.getSalonBookingRow(id, auth.user.id);
    if (current && current.client_user_id && proposals.SALON_CONFIRMED.includes(current.status)
      && (patch.bookingDate !== current.booking_date || patch.time !== normalizeBookingTimeLabel(current.time || ""))) {
      const made = await proposals.proposeSalonTime({ salonUserId: auth.user.id, id, date: patch.bookingDate, time: patch.time });
      if (!made.ok) {
        return noStoreJson({ error: made.message, code: made.error.toUpperCase(), ...(made.phone ? { data: { phone: made.phone } } : {}) }, { status: made.error === "missing" ? 404 : made.error === "same" ? 400 : 409 });
      }
      noticeClientTimeProposal(Number(current.client_user_id), {
        provider: { type: "salon", name: auth.user.name },
        booking: { ...made.booking, kind: "salon" },
        toDate: made.toDate,
        toTime: made.toTime
      });
      return noStoreJson({ data: { booking: made.booking, bookings: await salons.listSalonBookings(auth.user.id), proposal: true, linkedArtistId: null, linkedArtistIds: [] } });
    }
  }
  // A new time (or day) must be one the «تغییر ساعت» list offers: its services fit with their
  // artists, and it ends by closing time -- or past it only when the salon chose to stay longer.
  if (!wantsCancel && movesTo && body.staff === undefined && body.parts === undefined) {
    const current = await salons.getSalonBookingRow(id, auth.user.id);
    if (!current) return noStoreJson({ error: "این نوبت رو پیدا نکردیم." }, { status: 404 });
    const dateKey = patch.bookingDate;
    const time = patch.time;
    const unchanged = dateKey === current.booking_date && time === normalizeBookingTimeLabel(current.time || "");
    if (!unchanged) {
      const options = await bookingMoveOptions(auth.user.id, id, dateKey);
      const option = options.times?.find((item) => item.time === time);
      if (!option) {
        return noStoreJson({
          error: options.closed ? "سالن این روز تعطیله." : "این ساعت برای این نوبت جا نداره؛ یکی از ساعت‌های فهرست رو بزن.",
          code: "MOVE_TIME_UNAVAILABLE"
        }, { status: 409 });
      }
      if (option.overtimeMinutes > 0 && body.overtime !== true) {
        return noStoreJson({
          error: `این نوبت تا ${toPersianDigits(option.end)} طول می‌کشه؛ ${toPersianDigits(option.overtimeMinutes)} دقیقه بعد از ساعت کاری.`,
          code: "NEEDS_OVERTIME"
        }, { status: 409 });
      }
    }
  }
  // What the booking's status was before this call: the client is only told about an answer that really changed it.
  const statusBefore = (await salons.getSalonBookingRow(id, auth.user.id))?.status ?? null;
  // A new day or time for a client's booking goes to the client to accept (withClientConsent).
  const result = await salons.patchSalonBookingWithArtistSync(id, auth.user.id, patch, {
    askClient: true,
    ...(wantsCancel ? { cancelledBy: { by: "provider", userId: auth.user.id } } : {})
  });

  if (!result.ok) {
    if (result.error === "missing") {
      return noStoreJson({ error: "این نوبت رو پیدا نکردیم." }, { status: 404 });
    }
    if (result.error === "past") {
      return noStoreJson({ error: "رزرو گذشته قابل ویرایش نیست." }, { status: 409 });
    }
    if (result.error === "expired") {
      return noStoreJson({
        error: "وقت جواب دادن به این درخواست تموم شده.",
        code: "BOOKING_EXPIRED",
        data: { bookings: await salons.listSalonBookings(auth.user.id) }
      }, { status: 409 });
    }
    if (result.error === "artist_conflict") {
      return noStoreJson({
        error: result.message || "آرتیست این ساعت نوبت داره؛ یه ساعت دیگه بزن.",
        code: result.code || "ARTIST_SLOT_TAKEN",
        data: { bookings: await salons.listSalonBookings(auth.user.id) }
      }, { status: 409 });
    }
    if (result.error === "unavailable") {
      return noStoreJson({
        error: result.message || "این درخواست دیگه تأیید نمی‌شه.",
        code: "REQUEST_NOT_POSSIBLE",
        data: { bookings: await salons.listSalonBookings(auth.user.id) }
      }, { status: 409 });
    }
    if (result.error === "needs_proposal") {
      return noStoreJson({ error: "نوبت تأییدشده فقط با پیشنهاد به مشتری جابه‌جا می‌شه.", code: "NEEDS_PROPOSAL" }, { status: 409 });
    }
    if (result.error === "awaiting_client") {
      return noStoreJson({ error: "مشتری هنوز به ساعت تازه جواب نداده؛ قبول کنه، خودش تأیید می‌شه.", code: "AWAITING_CLIENT" }, { status: 409 });
    }
    if (result.error === "inactive" || result.error === "stale") {
      return noStoreJson({
        error: "این نوبت همین الان عوض شد؛ فهرست رو تازه کردیم، یه نگاه دیگه بنداز.",
        code: "BOOKING_CHANGED",
        data: { bookings: await salons.listSalonBookings(auth.user.id) }
      }, { status: 409 });
    }
    if (result.error === "parts") {
      return noStoreJson({ error: "کارهای این نوبت درست نرسید؛ دوباره بزن." }, { status: 400 });
    }
    return noStoreJson({
      error: result.message || "این ساعت نمی‌شه؛ یه ساعت دیگه بزن.",
      data: { bookings: await salons.listSalonBookings(auth.user.id) }
    }, { status: 409 });
  }

  // Only for an explicit approve/cancel decision (wantsCancel or the
  // whitelisted "تایید شده" transition above) — a plain time/staff edit
  // patches through the same route with no status field and shouldn't spam
  // a push for every minor change.
  const statusChanged = statusBefore !== null && result.booking.status !== statusBefore;
  if (statusChanged && (patch.status === "تایید شده" || patch.status === "لغو")) {
    const bookingClientUserId = result.booking.client_user_id ? Number(result.booking.client_user_id) : null;
    // Cancelling a booking that was already confirmed is a broken promise: the client gets the apology push + SMS
    // (booking_cancelled_by_provider), never the plain "cancelled" answer on top of it.
    if (bookingClientUserId && patch.status === "لغو" && proposals.SALON_CONFIRMED.includes(statusBefore)) {
      noticeClientCancelledByProvider(bookingClientUserId, {
        provider: { type: "salon", name: auth.user.name },
        booking: { kind: "salon", id, booking_date: result.booking.booking_date, time: result.booking.time, service: result.booking.service }
      });
    } else if (bookingClientUserId) {
      const push = sendPushToUser(bookingClientUserId, {
        title: patch.status === "تایید شده" ? "نوبتت تأیید شد" : "نوبتت لغو شد",
        body: `${result.booking.service || "نوبت"}، ${bookingWhen(result.booking.booking_date, result.booking.time)}`
      }).catch(() => null);
      smsBookingAnswer(bookingClientUserId, {
        providerName: auth.user.name,
        bookingDate: result.booking.booking_date,
        time: result.booking.time,
        confirmed: patch.status === "تایید شده",
        booking: { kind: "salon", id }
      }, push);
    }
    notifyStaff({ artistIds: result.linkedArtistIds, salonBookingId: result.booking.id, exceptUserId: auth.user.id }, {
      title: patch.status === "تایید شده" ? "نوبتت توی سالن تأیید شد" : "نوبتت توی سالن لغو شد",
      body: `${result.booking.client || "مشتری"}، ${result.booking.service || "نوبت"}، ${bookingWhen(result.booking.booking_date, result.booking.time)}`
    });
  }

  // The salon moved a client's booking: the client hears about the new time right away.
  const moved = ["time", "booking_date", "bookingDate", "date"].some((key) => body[key] != null);
  if (!wantsCancel && moved && result.booking.status === AWAITING_CLIENT && result.booking.client_user_id) {
    void sendPushToUser(Number(result.booking.client_user_id), {
      title: "سالن یه ساعت دیگه پیشنهاد داد",
      body: `${auth.user.name || "سالن"} برای ${result.booking.service || "نوبت"} ${bookingWhen(result.booking.booking_date, result.booking.time)} رو پیشنهاد داده. قبول می‌کنی؟`
    });
  }

  return noStoreJson({
    data: {
      booking: result.booking,
      bookings: await salons.listSalonBookings(auth.user.id),
      linkedArtistId: result.linkedArtistId ?? null,
      linkedArtistIds: result.linkedArtistIds || []
    }
  });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
export const PATCH = withErrorHandling(_PATCH);
