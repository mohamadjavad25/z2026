import { NextResponse } from "next/server";
import { requireUser, validateBody, withErrorHandling } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as salons from "../../lib/db/repos/salons.js";
import * as artists from "../../lib/db/repos/artists.js";
import { checkRateLimit } from "../../lib/rateLimit.js";
import { sendPushToUser } from "../../lib/push.js";
import { createBookingSchema } from "../../lib/validation/booking.js";
// Side-effect import: starts the once-per-process 1-hour booking-request
// auto-expiry sweep (see that file's docstring) the first time this route
// module loads — same self-starting-on-import convention as
// app/lib/rateLimit.js's sweep. This is this app's busiest salon-booking
// entry point (polled every 8s by both the salon owner dashboard and the
// client's own-bookings view), so it starts within seconds of real use.
import { sweepExpiredBookingRequestsIfDue } from "../../lib/bookingExpirySweep.js";
import { resolveRollingPersianDateKey } from "../../shared/lib/persianCalendar.js";
import { visitSlotProblem } from "../../lib/visitSlotRules.js";
import { normalizeBookingTimeLabel, parseServiceDurationMinutes } from "../../shared/lib/time.js";
import { summarizeBookingParts } from "../../shared/lib/bookingParts.js";
import { salonVisitParts } from "../../lib/salonVisitParts.js";
import { bookingMoveOptions } from "../../lib/salonMoveTimes.js";
import { toPersianDigits } from "../../shared/lib/digits.js";
import { AWAITING_CLIENT } from "../../shared/lib/bookingOffer.js";
import { onlineBookingBlock } from "../../lib/billing/access.js";
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

// No single entry is longer than this, whoever sends it.
const MAX_BOOKING_MINUTES = 720;

function resolveRequestedDuration(body, salon, { isClient = false } = {}) {
  const serviceName = String(body.service || "").trim();
  const listed = Array.isArray(salon?.services)
    ? salon.services.find((item) => String(item?.name || "").trim() === serviceName)
    : null;
  // A client never chooses how long a service the salon lists takes: that is the salon's own number.
  if (isClient && listed?.duration) return parseServiceDurationMinutes(listed.duration);
  const explicit = Number(body.durationMinutes || body.duration_minutes);
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(MAX_BOOKING_MINUTES, Math.max(15, explicit));
  if (body.duration) return Math.min(MAX_BOOKING_MINUTES, parseServiceDurationMinutes(body.duration));
  if (listed?.duration) return parseServiceDurationMinutes(listed.duration);
  return 60;
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
    return noStoreJson({ data: { unavailableSlots, hours: await salons.listSalonHours(salonUserId) } });
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

  const body = await request.json();
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
  const salon = await salons.getSalon(salonUserId);
  if (!salon) return noStoreJson({ error: "سالن پیدا نشد." }, { status: 404 });
  if (auth.user.type === "salon" && salonUserId !== auth.user.id) {
    return noStoreJson({ error: "دسترسی غیرمجاز." }, { status: 403 });
  }
  // A salon whose subscription has closed takes no new online requests; its own entries for walk-in customers go on.
  if (auth.user.type === "client") {
    const blocked = await onlineBookingBlock(salonUserId, "salon");
    if (blocked) return noStoreJson({ error: blocked.error, code: blocked.code }, { status: blocked.status });
  }
  const client = String(body.client || auth.user.name || "").trim();
  const phone = String(body.phone || auth.user.phone || "").trim();
  const parts = salonVisitParts(salon, v.data.parts, { allowStaff: auth.user.type === "salon" })
    .map(({ service, minutes, staff }) => ({ service, minutes, staff }));
  const multiPart = parts.length >= 2;
  const service = multiPart ? summarizeBookingParts(parts).service : String(body.service || "").trim();
  const rawBookingDay = body.bookingDate || body.booking_date || body.date || "";
  const bookingDateKey = resolveRollingPersianDateKey(rawBookingDay);
  const time = String(body.time || "").trim();
  const durationMinutes = multiPart ? summarizeBookingParts(parts).durationMinutes : resolveRequestedDuration(body, salon, { isClient: auth.user.type === "client" });
  if (!service) return noStoreJson({ error: "خدمت رزرو مشخص نیست." }, { status: 400 });
  if (!rawBookingDay) return noStoreJson({ error: "روز رزرو مشخص نیست." }, { status: 400 });
  if (!time) return noStoreJson({ error: "ساعت رزرو مشخص نیست." }, { status: 400 });
  if (!client) return noStoreJson({ error: "نام مشتری برای رزرو لازم است." }, { status: 400 });
  if (auth.user.type === "client" && !phone) {
    return noStoreJson({ error: "برای ثبت رزرو، شماره تماس لازم است." }, { status: 400 });
  }
  const slotProblem = visitSlotProblem({
    hours: await salons.listSalonHours(salonUserId),
    bookingDateKey,
    time,
    durationMinutes,
    isClient: auth.user.type === "client"
  });
  if (slotProblem) {
    return noStoreJson(
      slotProblem.code === "TOO_SOON" ? { error: slotProblem.error, code: slotProblem.code } : { error: slotProblem.error },
      { status: slotProblem.status }
    );
  }
  // A client's single-service request with no artist named gets one the way a visit's services
  // do (a free artist who does it, the work spread over the team); refused when nobody who could
  // do it is free -- the availability list never offers such a time.
  // Only the salon names an artist; a client's request is split by the draft below.
  let staffName = auth.user.type === "salon" ? String(body.staff || "").trim() : "";
  if (!multiPart && auth.user.type === "client" && !staffName) {
    const draft = await salons.draftSingleBookingStaff(salonUserId, bookingDateKey, time, service, durationMinutes);
    if (draft.unstaffed) {
      return noStoreJson({ error: `برای «${service}» در این ساعت آرتیست آزادی نیست.`, code: "NO_FREE_ARTIST" }, { status: 409 });
    }
    staffName = draft.staff;
  }
  // A multi-service booking links its artists per service inside addSalonBooking. A client's
  // request with no artist free (and nobody who could do it) stays unlinked.
  const linkedStaff = multiPart || (auth.user.type === "client" && !staffName)
    ? null
    : await salons.findSalonStaffForBooking(salonUserId, staffName, body.service);
  if (linkedStaff?.artist_user_id && await artists.isArtistSlotBlocked(
    Number(linkedStaff.artist_user_id),
    bookingDateKey,
    time,
    durationMinutes
  )) {
    return noStoreJson({
      error: "این ساعت برای آرتیست قبلاً رزرو شده است.",
      code: "ARTIST_SLOT_TAKEN",
      data: { bookings: await salons.listSalonBookings(salonUserId) }
    }, { status: 409 });
  }
  // A client's own booking is a REQUEST the salon must answer ("درخواست": shows up in the salon's
  // pending list, expires after an hour). An entry made by the salon itself is already settled
  // ("تازه"). The status is decided here, never read from the body.
  const result = await salons.addSalonBooking(salonUserId, {
    ...v.data,
    staff: multiPart ? "" : staffName,
    status: auth.user.type === "client" ? "درخواست" : "تازه",
    client,
    phone,
    service,
    bookingDate: bookingDateKey,
    time,
    durationMinutes,
    parts: multiPart ? parts : undefined,
    requireStaff: auth.user.type === "client",
    // A booking is only ever tied to an account by that account itself (the salon's own entries stay
    // with the name and number it typed), so nobody can put a booking into another person's list.
    clientUserId: auth.user.type === "client" ? auth.user.id : null
  });
  if (!result.ok) {
    if (result.error === "no_staff") {
      return noStoreJson({ error: result.message, code: "NO_FREE_ARTIST" }, { status: 409 });
    }
    if (result.error === "artist_conflict") {
      return noStoreJson({ error: result.message || "این ساعت برای آرتیست قبلاً رزرو شده است.", code: result.code || "ARTIST_SLOT_TAKEN" }, { status: 409 });
    }
    return noStoreJson({ error: "این زمان قبلاً رزرو شده است." }, { status: 409 });
  }
  let artistBooking = null;
  if (linkedStaff?.artist_user_id) {
    const artistResult = await artists.addArtistBooking(Number(linkedStaff.artist_user_id), {
      client: result.booking.client,
      phone: result.booking.phone,
      service: result.booking.service,
      serviceEmoji: result.booking.service_emoji,
      bookingDate: result.booking.booking_date,
      time: result.booking.time,
      // The artist's calendar holds the service for its own length (it used to fall back to an hour).
      durationMinutes: result.booking.duration_minutes,
      sourceSalonUserId: salonUserId,
      status: result.booking.status || "تازه"
    });
    if (artistResult.ok) {
      artistBooking = artistResult.booking;
    } else {
      await salons.cancelSalonBooking(Number(result.booking.id), salonUserId);
      return noStoreJson({
        error: artistResult.error || "رزرو برای آرتیست ثبت نشد.",
        code: artistResult.code || "ARTIST_BOOKING_FAILED",
        data: { bookings: await salons.listSalonBookings(salonUserId) }
      }, { status: artistResult.code === "SLOT_TAKEN" ? 409 : 400 });
    }
  }
  // Real-time heads-up for the salon the moment a real client requests a
  // slot, not just whenever they next happen to poll/open the dashboard —
  // only when the CLIENT is the one who just requested it (a salon entering
  // its own walk-in booking doesn't need to be told about its own action).
  if (auth.user.type === "client") {
    void sendPushToUser(salonUserId, {
      title: "درخواست رزرو جدید",
      body: `${client} — ${service} · ${time}`
    });
    smsNewBookingRequest(salonUserId, { client, service, bookingDate: bookingDateKey, time });
  }

  return noStoreJson({
    data: {
      booking: result.booking,
      bookings: await salons.listSalonBookings(salonUserId),
      artistBooking,
      linkedArtistId: linkedStaff?.artist_user_id || result.linkedArtistIds?.[0] || null,
      linkedArtistIds: result.linkedArtistIds || (linkedStaff?.artist_user_id ? [linkedStaff.artist_user_id] : [])
    }
  }, { status: 201 });
}

async function _PATCH(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const forbidden = requireSalon(auth.user);
  if (forbidden) return forbidden;
  const body = await request.json();
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
  // A new time (or day) must be one the «تغییر ساعت» list offers: its services fit with their
  // artists, and it ends by closing time -- or past it only when the salon chose to stay longer.
  const movesTo = ["time", "booking_date", "bookingDate", "date"].some((key) => body[key] != null);
  if (!wantsCancel && movesTo && body.staff === undefined && body.parts === undefined) {
    const current = await salons.getSalonBookingRow(id, auth.user.id);
    if (!current) return noStoreJson({ error: "رزرو یافت نشد." }, { status: 404 });
    const dateKey = resolveRollingPersianDateKey(body.booking_date ?? body.bookingDate ?? body.date ?? current.booking_date);
    const time = normalizeBookingTimeLabel(String(body.time ?? current.time ?? ""));
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
  if (patch.status === "تایید شده" || patch.status === "لغو") {
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
        confirmed: patch.status === "تایید شده"
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
