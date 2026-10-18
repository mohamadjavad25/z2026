import * as salons from "./db/repos/salons.js";
import * as artists from "./db/repos/artists.js";
import { onlineBookingBlock } from "./billing/access.js";
import { resolveRollingPersianDateKey } from "../shared/lib/persianCalendar.js";
import { visitSlotProblem } from "./visitSlotRules.js";
import { parseServiceDurationMinutes } from "../shared/lib/time.js";
import { summarizeBookingParts } from "../shared/lib/bookingParts.js";
import { salonVisitParts } from "./salonVisitParts.js";
import { BOOKING_REQUEST_WINDOW_MINUTES } from "../shared/lib/bookingWindow.js";

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

const refuse = (status, error, code = "", withBookings = false) => ({ ok: false, status, error, code, withBookings });

/**
 * One new booking at a salon, with every check POST /api/salon-bookings makes: the salon takes
 * online requests, the day and time fit its hours, a free artist for each service, nobody's calendar
 * double-booked. Shared by that route and by the expiry sweep, which sends an unanswered request on
 * to the client's backup salon through exactly the same door.
 *
 * `actor` is who is booking ({ type: "client" | "salon", id, name, phone }); `body` the raw request,
 * `data` its validated copy (createBookingSchema). `wait` is the client's response window
 * ({ minutes: 60 | null, fallbackSalonUserId, movedFromBookingId }).
 * → { ok: true, booking, artistBooking, linkedArtistIds } or { ok: false, status, error, code, withBookings }.
 */
export async function createSalonBooking({ actor, salonUserId, body, data, wait = {} }) {
  const isClient = actor.type === "client";
  const salon = await salons.getSalon(salonUserId);
  if (!salon) return refuse(404, "سالن پیدا نشد.");
  // A salon whose subscription has closed takes no new online requests; its own entries for walk-in customers go on.
  if (isClient) {
    const blocked = await onlineBookingBlock(salonUserId, "salon");
    if (blocked) return refuse(blocked.status, blocked.error, blocked.code);
  }
  const client = String(body.client || actor.name || "").trim();
  const phone = String(body.phone || actor.phone || "").trim();
  const parts = salonVisitParts(salon, data.parts, { allowStaff: actor.type === "salon" })
    .map(({ service, minutes, staff }) => ({ service, minutes, staff }));
  const multiPart = parts.length >= 2;
  const service = multiPart ? summarizeBookingParts(parts).service : String(body.service || "").trim();
  const rawBookingDay = body.bookingDate || body.booking_date || body.date || "";
  const bookingDateKey = resolveRollingPersianDateKey(rawBookingDay);
  const time = String(body.time || "").trim();
  const durationMinutes = multiPart ? summarizeBookingParts(parts).durationMinutes : resolveRequestedDuration(body, salon, { isClient });
  if (!service) return refuse(400, "خدمت رزرو مشخص نیست.");
  if (!rawBookingDay) return refuse(400, "روز رزرو مشخص نیست.");
  if (!time) return refuse(400, "ساعت رزرو مشخص نیست.");
  if (!client) return refuse(400, "نام مشتری برای رزرو لازم است.");
  if (isClient && !phone) return refuse(400, "برای ثبت رزرو، شماره تماس لازم است.");
  const slotProblem = visitSlotProblem({
    hours: await salons.listSalonHours(salonUserId),
    bookingDateKey,
    time,
    durationMinutes,
    isClient
  });
  if (slotProblem) return refuse(slotProblem.status, slotProblem.error, slotProblem.code === "TOO_SOON" ? slotProblem.code : "");
  // A client's single-service request with no artist named gets one the way a visit's services
  // do (a free artist who does it, the work spread over the team); refused when nobody who could
  // do it is free -- the availability list never offers such a time.
  // Only the salon names an artist; a client's request is split by the draft below.
  let staffName = actor.type === "salon" ? String(body.staff || "").trim() : "";
  if (!multiPart && isClient && !staffName) {
    const draft = await salons.draftSingleBookingStaff(salonUserId, bookingDateKey, time, service, durationMinutes);
    if (draft.unstaffed) return refuse(409, `برای «${service}» در این ساعت آرتیست آزادی نیست.`, "NO_FREE_ARTIST");
    staffName = draft.staff;
  }
  // A multi-service booking links its artists per service inside addSalonBooking. A client's
  // request with no artist free (and nobody who could do it) stays unlinked.
  const linkedStaff = multiPart || (isClient && !staffName)
    ? null
    : await salons.findSalonStaffForBooking(salonUserId, staffName, body.service);
  if (linkedStaff?.artist_user_id && await artists.isArtistSlotBlocked(
    Number(linkedStaff.artist_user_id),
    bookingDateKey,
    time,
    durationMinutes
  )) {
    return refuse(409, "این ساعت برای آرتیست قبلاً رزرو شده است.", "ARTIST_SLOT_TAKEN", true);
  }
  // A client's own booking is a REQUEST the salon must answer ("درخواست": shows up in the salon's
  // pending list, waits as long as the client chose). An entry made by the salon itself is already
  // settled ("تازه"). The status is decided here, never read from the body.
  const result = await salons.addSalonBooking(salonUserId, {
    ...data,
    staff: multiPart ? "" : staffName,
    status: isClient ? "درخواست" : "تازه",
    client,
    phone,
    service,
    bookingDate: bookingDateKey,
    time,
    durationMinutes,
    parts: multiPart ? parts : undefined,
    requireStaff: isClient,
    // A booking is only ever tied to an account by that account itself (the salon's own entries stay
    // with the name and number it typed), so nobody can put a booking into another person's list.
    clientUserId: isClient ? actor.id : null,
    waitMinutes: isClient && wait.minutes !== undefined ? wait.minutes : BOOKING_REQUEST_WINDOW_MINUTES,
    fallbackSalonUserId: isClient ? wait.fallbackSalonUserId || null : null,
    movedFromBookingId: wait.movedFromBookingId || null
  });
  if (!result.ok) {
    if (result.error === "no_staff") return refuse(409, result.message, "NO_FREE_ARTIST");
    if (result.error === "artist_conflict") {
      return refuse(409, result.message || "این ساعت برای آرتیست قبلاً رزرو شده است.", result.code || "ARTIST_SLOT_TAKEN");
    }
    return refuse(409, "این زمان قبلاً رزرو شده است.");
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
      return refuse(
        artistResult.code === "SLOT_TAKEN" ? 409 : 400,
        artistResult.error || "رزرو برای آرتیست ثبت نشد.",
        artistResult.code || "ARTIST_BOOKING_FAILED",
        true
      );
    }
  }
  const linkedArtistIds = result.linkedArtistIds || (linkedStaff?.artist_user_id ? [linkedStaff.artist_user_id] : []);
  return { ok: true, booking: result.booking, artistBooking, linkedArtistIds, client, service, time };
}
