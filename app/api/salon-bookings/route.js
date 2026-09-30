import { NextResponse } from "next/server";
import { requireUser, validateBody } from "../../lib/http.js";
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
import "../../lib/bookingExpirySweep.js";
import { resolveRollingPersianDateKey } from "../../shared/lib/persianCalendar.js";
import {
  buildDayBookingSlots,
  parseServiceDurationMinutes,
  timeLabelToMinutes
} from "../../shared/lib/time.js";

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

function normalizeDayLabel(value) {
  return String(value || "").replace(/\s/g, "");
}

function findHourForBookingDay(hours, rawDay, bookingDateKey) {
  const normalizedDay = normalizeDayLabel(rawDay);
  return hours.find((hour) => (
    normalizeDayLabel(hour?.day) === normalizedDay
      || resolveRollingPersianDateKey(hour?.day || "") === bookingDateKey
  )) || null;
}

function resolveRequestedDuration(body, salon) {
  const explicit = Number(body.durationMinutes || body.duration_minutes);
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(15, explicit);
  if (body.duration) return parseServiceDurationMinutes(body.duration);
  const serviceName = String(body.service || "").trim();
  const service = Array.isArray(salon?.services)
    ? salon.services.find((item) => String(item?.name || "").trim() === serviceName)
    : null;
  if (service?.duration) return parseServiceDurationMinutes(service.duration);
  return 60;
}

export async function GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const requestedSalonId = searchParams.get("salonUserId");
  if (requestedSalonId) {
    const salonUserId = Number(requestedSalonId);
    if (!salonUserId) return noStoreJson({ error: "شناسه سالن نامعتبر است." }, { status: 400 });
    if (auth.user.type === "salon" && salonUserId === auth.user.id) {
      return noStoreJson({ bookings: await salons.listSalonBookings(auth.user.id) });
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
    return noStoreJson({ unavailableSlots, hours: await salons.listSalonHours(salonUserId) });
  }
  if (auth.user.type === "client") {
    return noStoreJson({ bookings: await salons.listClientSalonBookings(auth.user) });
  }
  const forbidden = requireSalon(auth.user);
  if (forbidden) return forbidden;
  return noStoreJson({ bookings: await salons.listSalonBookings(auth.user.id) });
}

export async function POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  // Per-caller throttle against booking-spam (a client scripting repeated
  // reservation requests, or a compromised session flooding a salon's
  // schedule). Same in-memory limiter/pattern this codebase already uses for
  // other abuse-prone routes (see /api/auth/login, /api/artist/bookings).
  const bookingLimited = checkRateLimit(`salon-booking-create:${auth.user.id}`, 20, 60_000);
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
  const client = String(body.client || auth.user.name || "").trim();
  const phone = String(body.phone || auth.user.phone || "").trim();
  const service = String(body.service || "").trim();
  const rawBookingDay = body.bookingDate || body.booking_date || body.date || "";
  const bookingDateKey = resolveRollingPersianDateKey(rawBookingDay);
  const time = String(body.time || "").trim();
  const durationMinutes = resolveRequestedDuration(body, salon);
  if (!service) return noStoreJson({ error: "خدمت رزرو مشخص نیست." }, { status: 400 });
  if (!rawBookingDay) return noStoreJson({ error: "روز رزرو مشخص نیست." }, { status: 400 });
  if (!time) return noStoreJson({ error: "ساعت رزرو مشخص نیست." }, { status: 400 });
  if (!client) return noStoreJson({ error: "نام مشتری برای رزرو لازم است." }, { status: 400 });
  if (auth.user.type === "client" && !phone) {
    return noStoreJson({ error: "برای ثبت رزرو، شماره تماس لازم است." }, { status: 400 });
  }
  const hour = findHourForBookingDay(await salons.listSalonHours(salonUserId), rawBookingDay, bookingDateKey);
  if (hour && !Number(hour.active)) {
    return noStoreJson({ error: "سالن در این روز تعطیل است." }, { status: 409 });
  }
  const allowedTimes = buildDayBookingSlots(
    hour?.open_time || "۱۰:۰۰",
    hour?.close_time || "۲۰:۰۰",
    durationMinutes
  );
  const requestedMinutes = timeLabelToMinutes(time);
  if (!allowedTimes.some((slot) => timeLabelToMinutes(slot) === requestedMinutes)) {
    return noStoreJson({ error: "این ساعت خارج از زمان کاری سالن است." }, { status: 409 });
  }
  const linkedStaff = await salons.findSalonStaffForBooking(salonUserId, body.staff, body.service);
  if (linkedStaff?.artist_user_id && await artists.isArtistSlotBlocked(
    Number(linkedStaff.artist_user_id),
    bookingDateKey,
    time,
    durationMinutes
  )) {
    return noStoreJson({
      error: "این ساعت برای آرتیست قبلاً رزرو شده است.",
      code: "ARTIST_SLOT_TAKEN",
      bookings: await salons.listSalonBookings(salonUserId)
    }, { status: 409 });
  }
  const result = await salons.addSalonBooking(salonUserId, {
    ...v.data,
    client,
    phone,
    service,
    bookingDate: bookingDateKey,
    time,
    durationMinutes,
    clientUserId: auth.user.type === "client" ? auth.user.id : body.clientUserId || body.client_user_id || null
  });
  if (!result.ok) {
    return noStoreJson({ error: "این زمان قبلاً رزرو شده است." }, { status: 409 });
  }
  let artistBooking = null;
  if (linkedStaff?.artist_user_id) {
    const artistResult = await artists.addArtistBooking(Number(linkedStaff.artist_user_id), {
      client: result.booking.client,
      phone: result.booking.phone,
      service: result.booking.service,
      bookingDate: result.booking.booking_date,
      time: result.booking.time,
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
        bookings: await salons.listSalonBookings(salonUserId)
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
  }

  return noStoreJson({
    booking: result.booking,
    bookings: await salons.listSalonBookings(salonUserId),
    artistBooking,
    linkedArtistId: linkedStaff?.artist_user_id || null
  }, { status: 201 });
}

export async function PATCH(request) {
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
  const patch = wantsCancel ? { status: "لغو" } : body;
  const result = await salons.patchSalonBookingWithArtistSync(id, auth.user.id, patch);

  if (!result.ok) {
    if (result.error === "missing") {
      return noStoreJson({ error: "رزرو یافت نشد." }, { status: 404 });
    }
    if (result.error === "expired") {
      return noStoreJson({
        error: "این درخواست به‌دلیل عدم پاسخ به‌موقع منقضی شده و دیگر قابل تایید نیست.",
        code: "BOOKING_EXPIRED",
        bookings: await salons.listSalonBookings(auth.user.id)
      }, { status: 409 });
    }
    if (result.error === "artist_conflict") {
      return noStoreJson({
        error: result.message || "این ساعت برای آرتیست قبلاً رزرو شده است.",
        code: result.code || "ARTIST_SLOT_TAKEN",
        bookings: await salons.listSalonBookings(auth.user.id)
      }, { status: 409 });
    }
    return noStoreJson({
      error: "این زمان قابل رزرو نیست.",
      bookings: await salons.listSalonBookings(auth.user.id)
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
    }
  }

  return noStoreJson({
    booking: result.booking,
    bookings: await salons.listSalonBookings(auth.user.id),
    linkedArtistId: result.linkedArtistId ?? null,
    linkedArtistIds: result.linkedArtistIds || []
  });
}
