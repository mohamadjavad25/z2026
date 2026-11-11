/**
 * Making a salon booking: the salon's own entry, a client's request for one service (its artist drafted under the
 * day's lock) and a visit of several services. The artists' calendar copies go in with it, in the same transaction.
 */
import { getDb, withTransaction, get, run } from "../../../connection.js";
import { lockClientRequests, lockSalonDay, lockVisitDay } from "../../../locks.js";
import { TOO_MANY_OPEN_CODE, TOO_MANY_OPEN_MESSAGE, findIdenticalSalonRequest, openRequestLimitReached } from "../../openRequests.js";
import { addArtistBookingInTx } from "../../artists/bookings.js";
import { resolveBookingServiceEmoji } from "../../serviceEmoji.js";
import { resolveRollingPersianDateKey } from "../../../../../shared/lib/persianCalendar.js";
import { BOOKING_REQUEST_WINDOW_MINUTES } from "../../../../../shared/lib/bookingWindow.js";
import { parseBookingTime, parseServiceDurationMinutes } from "../../../../../shared/lib/time.js";
import { bookingPeople, parseBookingParts, serializeBookingParts, summarizeBookingParts } from "../../../../../shared/lib/bookingParts.js";
import { toPersianDigits } from "../../../../../shared/lib/digits.js";
import { listSalonServices } from "../services.js";
import { listSalonStaff } from "../staff.js";
import { ensureBookingPartsColumns } from "./columns.js";
import { findOverlapConflict } from "./day.js";
import { draftVisitParts, findUnstaffedPart, loadVisitDay, staffName } from "./draft.js";
import { artistConflictError, createPartMirrors, mirrorStatus } from "./mirrors.js";
import { invalidateUnavailable } from "./unavailable.js";

async function resolveSalonBookingDuration(salonUserId, data, runner) {
  const explicit = Number(data.durationMinutes || data.duration_minutes);
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(15, explicit);
  if (data.duration) return parseServiceDurationMinutes(data.duration);
  const serviceName = String(data.service || "").trim();
  if (serviceName) {
    const services = await listSalonServices(salonUserId, runner);
    const match = services.find((item) => String(item.name || "").trim() === serviceName);
    if (match?.duration) return parseServiceDurationMinutes(match.duration);
  }
  return 60;
}

export async function addSalonBooking(salonUserId, data) {
  const result = await addSalonBookingUncached(salonUserId, data);
  invalidateUnavailable(salonUserId);
  return result;
}

/**
 * wait_minutes, fallback_salon_user_id and moved_from_booking_id for a new row: how long a client's
 * request waits (60, or null = until its appointment), its backup salon and the request it was moved
 * from. Anything else keeps the hour.
 */
function requestWaitColumns(data) {
  const wait = data.waitMinutes === undefined ? BOOKING_REQUEST_WINDOW_MINUTES : data.waitMinutes;
  return [
    wait === null ? null : Math.max(1, Number(wait) || BOOKING_REQUEST_WINDOW_MINUTES),
    Number(data.fallbackSalonUserId || 0) || null,
    Number(data.movedFromBookingId || 0) || null
  ];
}

async function addSalonBookingUncached(salonUserId, data) {
  await ensureBookingPartsColumns();
  const bookingDate = resolveRollingPersianDateKey(data.bookingDate || data.booking_date || data.date || "");
  const time = parseBookingTime(String(data.time ?? ""));
  // Backstop for any caller that skipped the route-level checks: never store a guessed day or time.
  if (!bookingDate || !time) return { ok: false, error: "bad_slot", message: "روز و ساعت رو دوباره انتخاب کن." };
  if (parseBookingParts(data.parts).length >= 2) {
    return addMultiPartSalonBooking(salonUserId, { ...data, bookingDate, time });
  }
  const staff = data.staff || "";
  const durationMinutes = await resolveSalonBookingDuration(salonUserId, data, await getDb());
  // A client's request with no artist named: who does it is chosen below, under the one lock for this salon's day,
  // so simultaneous requests fill the free artists one by one instead of all being drafted onto the same person.
  if (data.requireStaff && !staff) {
    return addDraftedSingleSalonBooking(salonUserId, { ...data, bookingDate, time }, durationMinutes);
  }

  return withTransaction(null, async (db) => {
    await lockSalonDay(db, salonUserId, bookingDate);
    const conflict = await findOverlapConflict(db, {
      salonUserId,
      bookingDate,
      time,
      durationMinutes,
      staff
    });
    if (conflict) return { ok: false, error: "conflict" };

    const serviceEmoji = await resolveBookingServiceEmoji(db, {
      kind: "salon",
      ownerId: salonUserId,
      service: data.service,
      explicit: data.serviceEmoji ?? data.service_emoji
    });
    const info = await run(db, `
      INSERT INTO salon_bookings
        (salon_user_id, client_user_id, client, phone, service, service_emoji, staff, booking_date, time, duration_minutes, status,
         wait_minutes, fallback_salon_user_id, moved_from_booking_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `, [
      salonUserId,
      data.clientUserId || data.client_user_id || null,
      data.client || "",
      data.phone || "",
      data.service || "",
      serviceEmoji,
      staff,
      bookingDate,
      time,
      durationMinutes,
      data.status || "تازه",
      ...requestWaitColumns(data)
    ]);
    return {
      ok: true,
      booking: await get(db, "SELECT * FROM salon_bookings WHERE id = $1", [Number(info.rows[0].id)])
    };
  });
}

/**
 * What happens before a client's request is looked at for a place, under the client's own lock (so a burst of
 * parallel taps can't slip through): the same request already sent is returned as it is (merged, nothing new is
 * made), and a client with too many open requests is refused. null = go on.
 */
async function gateClientRequest(db, salonUserId, data, service) {
  const clientUserId = Number(data.clientUserId || data.client_user_id || 0);
  if (!clientUserId || !data.requireStaff) return null;
  await lockClientRequests(db, clientUserId);
  const same = await findIdenticalSalonRequest(db, {
    salonUserId,
    clientUserId,
    bookingDate: data.bookingDate,
    time: data.time,
    service
  });
  if (same) return { ok: true, booking: same, duplicate: true, linkedArtistIds: [] };
  if (await openRequestLimitReached(db, clientUserId, { kind: "salon", id: salonUserId })) {
    return { ok: false, error: "too_many", code: TOO_MANY_OPEN_CODE, message: TOO_MANY_OPEN_MESSAGE };
  }
  return null;
}

/**
 * A client's single-service request: the artist is drafted (draftVisitParts) while the salon's day and the days
 * of everyone who might take it are held, the booking and the artist's calendar copy go in together, and a
 * taken artist calendar rolls it all back.
 */
async function addDraftedSingleSalonBooking(salonUserId, data, durationMinutes) {
  const staffList = await listSalonStaff(salonUserId);
  try {
    return await withTransaction(null, async (db) => {
      const gate = await gateClientRequest(db, salonUserId, data, String(data.service || "").trim());
      if (gate) return gate;
      await lockVisitDay(db, salonUserId, data.bookingDate, staffList.map((person) => person.artist_user_id));
      const day = await loadVisitDay(db, salonUserId, data.bookingDate);
      const service = String(data.service || "").trim();
      const drafted = await draftVisitParts(day, data.time, [{ service, minutes: durationMinutes, staff: "" }], { prefer: data.preferStaff || "" });
      if (findUnstaffedPart(day, drafted)) {
        return { ok: false, error: "no_staff", message: `این ساعت برای «${service}» آرتیست آزاد نداریم؛ یه ساعت دیگه بزن.` };
      }
      const staff = drafted[0]?.staff || "";
      const conflict = await findOverlapConflict(db, {
        salonUserId,
        bookingDate: data.bookingDate,
        time: data.time,
        durationMinutes,
        staff
      });
      if (conflict) return { ok: false, error: "conflict" };
      const serviceEmoji = await resolveBookingServiceEmoji(db, {
        kind: "salon",
        ownerId: salonUserId,
        service: data.service,
        explicit: data.serviceEmoji ?? data.service_emoji
      });
      const info = await run(db, `
        INSERT INTO salon_bookings
          (salon_user_id, client_user_id, client, phone, service, service_emoji, staff, booking_date, time, duration_minutes, status,
           wait_minutes, fallback_salon_user_id, moved_from_booking_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id
      `, [
        salonUserId,
        data.clientUserId || data.client_user_id || null,
        data.client || "",
        data.phone || "",
        data.service || "",
        serviceEmoji,
        staff,
        data.bookingDate,
        data.time,
        durationMinutes,
        data.status || "تازه",
        ...requestWaitColumns(data)
      ]);
      const booking = await get(db, "SELECT * FROM salon_bookings WHERE id = $1", [Number(info.rows[0].id)]);
      const person = day.team.find((item) => staffName(item) === staff);
      const artistId = Number(person?.artist_user_id || 0);
      let artistBooking = null;
      if (artistId) {
        const created = await addArtistBookingInTx(artistId, {
          clientUserId: booking.client_user_id || null,
          client: booking.client,
          phone: booking.phone,
          service: booking.service,
          serviceEmoji: booking.service_emoji,
          bookingDate: booking.booking_date,
          time: booking.time,
          durationMinutes: booking.duration_minutes,
          sourceSalonUserId: salonUserId,
          status: mirrorStatus(booking.status)
        }, db);
        if (!created.ok) throw artistConflictError(created.code || "ARTIST_SLOT_TAKEN", created.error || "آرتیست این ساعت نوبت داره؛ یه ساعت دیگه بزن.");
        artistBooking = created.booking;
      }
      return { ok: true, booking, artistBooking, linkedArtistIds: artistId ? [artistId] : [] };
    });
  } catch (error) {
    if (error?.rollbackArtist) {
      return { ok: false, error: "artist_conflict", code: error.code, message: error.message };
    }
    throw error;
  }
}

/**
 * A booking with several services: the artists are drafted (draftVisitParts), every service's
 * range is checked against the salon's other bookings, and each artist's share goes into
 * their calendar -- all in one transaction, so a taken artist calendar rolls everything back.
 */
async function addMultiPartSalonBooking(salonUserId, data) {
  const staffList = await listSalonStaff(salonUserId);
  try {
    return await withTransaction(null, async (db) => {
      // Everyone who might do a service has their day held until this visit is in, so two requests
      // for the same time can't both be told "free".
      const gate = await gateClientRequest(db, salonUserId, data, summarizeBookingParts(parseBookingParts(data.parts)).service);
      if (gate) return gate;
      await lockVisitDay(db, salonUserId, data.bookingDate, staffList.map((person) => person.artist_user_id));
      const day = await loadVisitDay(db, salonUserId, data.bookingDate);
      const parts = await draftVisitParts(day, data.time, parseBookingParts(data.parts), { prefer: data.preferStaff || "" });
      // A client's request must find an artist for every service someone at the salon does
      // (the same rule listFeasibleVisitTimes shows them); the salon may leave one open.
      const unstaffed = data.requireStaff ? findUnstaffedPart(day, parts) : null;
      if (unstaffed) {
        // A group is answered as a whole: if the team can no longer seat all of them at once, nobody is booked.
        const people = bookingPeople(parts);
        if (people > 1) return { ok: false, error: "no_staff", code: "GROUP_FULL", message: `این ساعت دیگه برای ${toPersianDigits(people)} نفر جا نداره؛ ساعت‌ها رو تازه کردیم.` };
        return { ok: false, error: "no_staff", message: `این ساعت برای «${unstaffed.service}» آرتیست آزاد نداریم؛ یه ساعت دیگه بزن.` };
      }
      const { service, durationMinutes } = summarizeBookingParts(parts);
      const conflict = await findOverlapConflict(db, {
        salonUserId,
        bookingDate: data.bookingDate,
        time: data.time,
        durationMinutes,
        staff: "",
        parts
      });
      if (conflict) return { ok: false, error: "conflict" };

      const serviceEmoji = await resolveBookingServiceEmoji(db, {
        kind: "salon",
        ownerId: salonUserId,
        service: parts[0].service,
        explicit: data.serviceEmoji ?? data.service_emoji
      });
      const info = await run(db, `
        INSERT INTO salon_bookings
          (salon_user_id, client_user_id, client, phone, service, service_emoji, staff, booking_date, time, duration_minutes, status, parts,
           wait_minutes, fallback_salon_user_id, moved_from_booking_id)
        VALUES ($1, $2, $3, $4, $5, $6, '', $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id
      `, [
        salonUserId,
        data.clientUserId || data.client_user_id || null,
        data.client || "",
        data.phone || "",
        service,
        serviceEmoji,
        data.bookingDate,
        data.time,
        durationMinutes,
        data.status || "تازه",
        serializeBookingParts(parts),
        ...requestWaitColumns(data)
      ]);
      const booking = await get(db, "SELECT * FROM salon_bookings WHERE id = $1", [Number(info.rows[0].id)]);
      const linkedArtistIds = await createPartMirrors(db, salonUserId, booking, staffList);
      return { ok: true, booking, linkedArtistIds };
    });
  } catch (error) {
    if (error?.rollbackArtist) {
      return { ok: false, error: "artist_conflict", code: error.code, message: error.message };
    }
    throw error;
  }
}
