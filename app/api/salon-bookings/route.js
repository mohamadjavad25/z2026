import { NextResponse } from "next/server";
import { requireUser } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as salons from "../../lib/db/repos/salons.js";
import * as artists from "../../lib/db/repos/artists.js";
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
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const requestedSalonId = searchParams.get("salonUserId");
  if (requestedSalonId) {
    const salonUserId = Number(requestedSalonId);
    if (!salonUserId) return noStoreJson({ error: "شناسه سالن نامعتبر است." }, { status: 400 });
    if (auth.user.type === "salon" && salonUserId === auth.user.id) {
      return noStoreJson({ bookings: salons.listSalonBookings(auth.user.id) });
    }
    const unavailableSlots = salons.listSalonBookings(salonUserId)
      .filter((booking) => booking.status !== "لغو")
      .map((booking) => ({
        booking_date: booking.booking_date,
        time: booking.time,
        duration_minutes: booking.duration_minutes,
        service: booking.service,
        staff: booking.staff,
        status: booking.status
    }));
    return noStoreJson({ unavailableSlots, hours: salons.listSalonHours(salonUserId) });
  }
  if (auth.user.type === "client") {
    return noStoreJson({ bookings: salons.listClientSalonBookings(auth.user) });
  }
  const forbidden = requireSalon(auth.user);
  if (forbidden) return forbidden;
  return noStoreJson({ bookings: salons.listSalonBookings(auth.user.id) });
}

export async function POST(request) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await request.json();
  if (!["client", "salon"].includes(auth.user.type)) {
    return noStoreJson({ error: "فقط مشتری یا سالن می‌تواند رزرو ثبت کند." }, { status: 403 });
  }
  const salonUserId = body.salonUserId ? Number(body.salonUserId) : auth.user.id;
  if (!salonUserId) return noStoreJson({ error: "شناسه سالن نامعتبر است." }, { status: 400 });
  const salon = salons.getSalon(salonUserId);
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
  const hour = findHourForBookingDay(salons.listSalonHours(salonUserId), rawBookingDay, bookingDateKey);
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
  const linkedStaff = salons.findSalonStaffForBooking(salonUserId, body.staff, body.service);
  if (linkedStaff?.artist_user_id && artists.isArtistSlotBlocked(
    Number(linkedStaff.artist_user_id),
    bookingDateKey,
    time,
    durationMinutes
  )) {
    return noStoreJson({
      error: "این ساعت برای آرتیست قبلاً رزرو شده است.",
      code: "ARTIST_SLOT_TAKEN",
      bookings: salons.listSalonBookings(salonUserId)
    }, { status: 409 });
  }
  const result = salons.addSalonBooking(salonUserId, {
    ...body,
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
    const artistResult = artists.addArtistBooking(Number(linkedStaff.artist_user_id), {
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
      salons.cancelSalonBooking(Number(result.booking.id), salonUserId);
      return noStoreJson({
        error: artistResult.error || "رزرو برای آرتیست ثبت نشد.",
        code: artistResult.code || "ARTIST_BOOKING_FAILED",
        bookings: salons.listSalonBookings(salonUserId)
      }, { status: artistResult.code === "SLOT_TAKEN" ? 409 : 400 });
    }
  }
  return noStoreJson({
    booking: result.booking,
    bookings: salons.listSalonBookings(salonUserId),
    artistBooking,
    linkedArtistId: linkedStaff?.artist_user_id || null
  }, { status: 201 });
}

export async function PATCH(request) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const forbidden = requireSalon(auth.user);
  if (forbidden) return forbidden;
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return noStoreJson({ error: "شناسه رزرو نامعتبر است." }, { status: 400 });

  const patch = body.status === "لغو" || body.action === "cancel"
    ? { status: "لغو" }
    : body;
  const result = salons.patchSalonBookingWithArtistSync(id, auth.user.id, patch);

  if (!result.ok) {
    if (result.error === "missing") {
      return noStoreJson({ error: "رزرو یافت نشد." }, { status: 404 });
    }
    if (result.error === "artist_conflict") {
      return noStoreJson({
        error: result.message || "این ساعت برای آرتیست قبلاً رزرو شده است.",
        code: result.code || "ARTIST_SLOT_TAKEN",
        bookings: salons.listSalonBookings(auth.user.id)
      }, { status: 409 });
    }
    return noStoreJson({
      error: "این زمان قابل رزرو نیست.",
      bookings: salons.listSalonBookings(auth.user.id)
    }, { status: 409 });
  }

  return noStoreJson({
    booking: result.booking,
    bookings: salons.listSalonBookings(auth.user.id),
    linkedArtistId: result.linkedArtistId ?? null,
    linkedArtistIds: result.linkedArtistIds || []
  });
}
