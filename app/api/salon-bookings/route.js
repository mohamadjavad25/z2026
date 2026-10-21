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
import { smsBookingAnswer, smsNewBookingRequest } from "../../lib/bookingSms.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreJson(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return NextResponse.json(body, { ...init, headers });
}

function requireSalon(user) {
  if (user.type !== "salon") return noStoreJson({ error: "فقط سالن." }, { status: 403 });
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
    if (!salonUserId) return noStoreJson({ error: "شناسه سالن نامعتبر است." }, { status: 400 });
    if (auth.user.type === "salon" && salonUserId === auth.user.id) {
      const bookings = await salons.listSalonBookings(auth.user.id);
      return noStoreJson({ data: { bookings } });
    }
    const allBookings = await salons.listSalonBookings(salonUserId);
    const unavailableSlots = allBookings
      // 'منقضی شده' (auto-expired request, see bookingExpirySweep.js) no longer
      // holds its slot, same as 'لغو' — otherwise a timed-out request would
      // wrongly go on blocking that slot for every other client forever.
      .filter((booking) => booking.status !== "لغو" && booking.status !== "منقضی شده")
      .map((booking) => ({
        booking_date: booking.booking_date,
        time: booking.time,
        duration_minutes: booking.duration_minutes,
        service: booking.service,
        staff: booking.staff,
        status: booking.status
    }));
    const hours = await salons.listSalonHours(salonUserId);
    if (!hours.length) return noStoreJson({ error: "این سالن پیدا نشد." }, { status: 404 });
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
    return noStoreJson({ error: "درخواست‌های زیاد. کمی صبر کن." }, { status: 429 });
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
  if (!salonUserId) return noStoreJson({ error: "شناسه سالن نامعتبر است." }, { status: 400 });
  if (auth.user.type === "salon" && salonUserId !== auth.user.id) {
    return noStoreJson({ error: "دسترسی غیرمجاز." }, { status: 403 });
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
  if (auth.user.type === "client") {
    void sendPushToUser(salonUserId, {
      title: "درخواست رزرو جدید",
      body: `${client} — ${service} · ${time}`
    });
    smsNewBookingRequest(salonUserId, { client, service, bookingDate: result.booking.booking_date, time, fromUserId: auth.user.id });
  }

  return noStoreJson({
    data: {
      booking: result.booking,
      ...(ownList ? { bookings: await salons.listSalonBookings(salonUserId) } : {}),
      artistBooking,
      linkedArtistId: linkedArtistIds[0] || null,
      linkedArtistIds
    }
  }, { status: 201 });
}

async function _PATCH(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const forbidden = requireSalon(auth.user);
  if (forbidden) return forbidden;
  const body = await readObjectBody(request);
  const id = Number(body.id);
  if (!id) return noStoreJson({ error: "شناسه رزرو نامعتبر است." }, { status: 400 });

  const wantsCancel = body.status === "لغو" || body.action === "cancel";
  // Whitelist, same shape as patchOwnArtistBooking in /api/artist/me: the only
  // status transitions a salon owner may set through this public route are
  // approve ("تایید شده") and cancel ("لغو"). Every other value — including
  // "منقضی شده", which is sweep-only (bookingExpirySweep.js) and otherwise
  // frees the slot early via the GET unavailableSlots filter — is rejected.
  // Other PATCH fields (time/staff/client/…) never carry a status, so this
  // only fires when the caller explicitly sends one.
  if (!wantsCancel && body.status != null && body.status !== "" && body.status !== "تایید شده") {
    return noStoreJson({ error: "وضعیت نامعتبر است." }, { status: 400 });
  }
  let patch = wantsCancel ? { status: "لغو" } : body;
  // «تقسیم خودکار»: the server re-drafts who does what (suggestBookingStaff) and saves it like
  // any other artist change -- each artist checked free, their calendars updated.
  if (!wantsCancel && body.autoAssign === true) {
    const suggestion = await salons.suggestBookingStaff(id, auth.user.id);
    if (!suggestion) return noStoreJson({ error: "رزرو یافت نشد." }, { status: 404 });
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
    if (!current) return noStoreJson({ error: "رزرو یافت نشد." }, { status: 404 });
    const rawDay = body.booking_date ?? body.bookingDate ?? body.date ?? current.booking_date;
    const rawTime = body.time ?? current.time ?? "";
    const slot = readBookingSlot(typeof rawDay === "string" ? rawDay : "", typeof rawTime === "string" ? rawTime : "");
    if (!slot.ok) return noStoreJson({ error: slot.error }, { status: slot.status });
    // What is saved is the canonical form, never the text as typed.
    patch = { ...patch, bookingDate: slot.dateKey, booking_date: undefined, date: undefined, time: slot.time };
  }
  // A new time (or day) must be one the «تغییر ساعت» list offers: its services fit with their
  // artists, and it ends by closing time -- or past it only when the salon chose to stay longer.
  if (!wantsCancel && movesTo && body.staff === undefined && body.parts === undefined) {
    const current = await salons.getSalonBookingRow(id, auth.user.id);
    if (!current) return noStoreJson({ error: "رزرو یافت نشد." }, { status: 404 });
    const dateKey = patch.bookingDate;
    const time = patch.time;
    const unchanged = dateKey === current.booking_date && time === normalizeBookingTimeLabel(current.time || "");
    if (!unchanged) {
      const options = await bookingMoveOptions(auth.user.id, id, dateKey);
      const option = options.times?.find((item) => item.time === time);
      if (!option) {
        return noStoreJson({
          error: options.closed ? "سالن در این روز تعطیل است." : "این ساعت برای این نوبت جا ندارد؛ یکی از ساعت‌های فهرست را انتخاب کن.",
          code: "MOVE_TIME_UNAVAILABLE"
        }, { status: 409 });
      }
      if (option.overtimeMinutes > 0 && body.overtime !== true) {
        return noStoreJson({
          error: `این ساعت تا ${toPersianDigits(option.end)} طول می‌کشد؛ ${toPersianDigits(option.overtimeMinutes)} دقیقه بعد از ساعت کاری.`,
          code: "NEEDS_OVERTIME"
        }, { status: 409 });
      }
    }
  }
  // What the booking's status was before this call: the client is only told about an answer that really changed it.
  const statusBefore = (await salons.getSalonBookingRow(id, auth.user.id))?.status ?? null;
  // A new day or time for a client's booking goes to the client to accept (withClientConsent).
  const result = await salons.patchSalonBookingWithArtistSync(id, auth.user.id, patch, { askClient: true });

  if (!result.ok) {
    if (result.error === "missing") {
      return noStoreJson({ error: "رزرو یافت نشد." }, { status: 404 });
    }
    if (result.error === "past") {
      return noStoreJson({ error: "رزرو گذشته قابل ویرایش نیست." }, { status: 409 });
    }
    if (result.error === "expired") {
      return noStoreJson({
        error: "این درخواست به‌دلیل عدم پاسخ به‌موقع منقضی شده و دیگر قابل تایید نیست.",
        code: "BOOKING_EXPIRED",
        data: { bookings: await salons.listSalonBookings(auth.user.id) }
      }, { status: 409 });
    }
    if (result.error === "artist_conflict") {
      return noStoreJson({
        error: result.message || "این ساعت برای آرتیست قبلاً رزرو شده است.",
        code: result.code || "ARTIST_SLOT_TAKEN",
        data: { bookings: await salons.listSalonBookings(auth.user.id) }
      }, { status: 409 });
    }
    if (result.error === "awaiting_client") {
      return noStoreJson({ error: "مشتری هنوز به ساعت تازه جواب نداده؛ بعد از قبولش تایید می‌شود.", code: "AWAITING_CLIENT" }, { status: 409 });
    }
    if (result.error === "inactive" || result.error === "stale") {
      return noStoreJson({
        error: "این رزرو همین الان تغییر کرد؛ فهرست را تازه کردیم، دوباره نگاه کن.",
        code: "BOOKING_CHANGED",
        data: { bookings: await salons.listSalonBookings(auth.user.id) }
      }, { status: 409 });
    }
    if (result.error === "parts") {
      return noStoreJson({ error: "فهرست خدمات این نوبت نامعتبر است." }, { status: 400 });
    }
    return noStoreJson({
      error: result.message || "این زمان قابل رزرو نیست.",
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
    if (bookingClientUserId) {
      void sendPushToUser(bookingClientUserId, {
        title: patch.status === "تایید شده" ? "نوبت شما تایید شد" : "نوبت شما لغو شد",
        body: `${result.booking.service || "نوبت"} — ${result.booking.booking_date || ""} ${result.booking.time || ""}`.trim()
      });
      smsBookingAnswer(bookingClientUserId, {
        providerName: auth.user.name,
        bookingDate: result.booking.booking_date,
        time: result.booking.time,
        confirmed: patch.status === "تایید شده",
        booking: { kind: "salon", id }
      });
    }
  }

  // The salon moved a client's booking: the client hears about the new time right away.
  const moved = ["time", "booking_date", "bookingDate", "date"].some((key) => body[key] != null);
  if (!wantsCancel && moved && result.booking.status === AWAITING_CLIENT && result.booking.client_user_id) {
    void sendPushToUser(Number(result.booking.client_user_id), {
      title: "ساعت تازه برای نوبتت",
      body: `${auth.user.name || "سالن"} ساعت ${result.booking.time || ""} را برای ${result.booking.service || "نوبت"} پیشنهاد داده. قبول یا رد کن.`
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
