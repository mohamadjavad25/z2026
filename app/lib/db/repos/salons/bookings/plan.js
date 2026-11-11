/**
 * Read-only answers about a visit before anything is written: which start times work, how a visit would be split,
 * who is free for each service of a booking, and where a booking can be moved to.
 */
import { getDb, get } from "../../../connection.js";
import { findLinkedSalonArtistBooking } from "../../artists/bookings.js";
import { listArtistBusyRanges } from "../../artists/calendar.js";
import { normalizeBookingTimeLabel, rangesOverlap } from "../../../../../shared/lib/time.js";
import { isMultiPartBooking, parseBookingParts, scheduleBookingParts } from "../../../../../shared/lib/bookingParts.js";
import { findSalonStaffForBooking } from "../bookingStaff.js";
import { listSalonStaff } from "../staff.js";
import { ensureBookingPartsColumns } from "./columns.js";
import { bookingSegments, listActiveDayBookings, staffScopesConflict } from "./day.js";
import { draftVisitParts, findUnstaffedPart, isStaffFree, isStaffWorking, loadVisitDay, staffForService, staffName, visitOverlaps } from "./draft.js";
import { listPartMirrors } from "./mirrors.js";

/**
 * The start times (from `times`) at which a client's request for these services will go
 * through -- the same checks POST /api/salon-bookings runs, so the client is never shown a
 * time that is then refused: in the draft (draftVisitParts) every service someone at the salon
 * could do gets a free artist, and nothing overlaps the salon's other bookings. One service
 * is just a visit of one part.
 */
export async function listFeasibleVisitTimes(salonUserId, bookingDate, parts, times, { prefer = "" } = {}) {
  await ensureBookingPartsColumns();
  const list = parseBookingParts(parts).map((part) => ({ ...part, staff: "" }));
  if (!list.length) return [];
  const day = await loadVisitDay(await getDb(), salonUserId, bookingDate);
  const feasible = [];
  for (const time of times) {
    const drafted = await draftVisitParts(day, time, list, { prefer });
    if (!findUnstaffedPart(day, drafted) && !visitOverlaps(day, time, drafted)) feasible.push(time);
  }
  return feasible;
}

/**
 * One visit at one start time as a screen shows it before booking: every service with its clock
 * time and artist -- the artist the salon named, else the draft (draftVisitParts, the same split the
 * booking itself gets) -- and the first thing that would make the booking be refused (`problem`).
 * `unstaffed` is the index of the first service nobody could be drafted for although someone at the
 * salon does it (-1 for none): a client's request is refused for it, the salon's own entry is not.
 * With `withOptions` each service also lists every team member with `free` (nothing of theirs in the
 * salon or their own calendar then), `skilled` (linked to the service) and `away` (their state when
 * inactive or on leave): the salon's artist picker. Null when there is no service.
 */
export async function previewVisit(salonUserId, bookingDate, time, parts, { withOptions = false, prefer = "" } = {}) {
  await ensureBookingPartsColumns();
  const list = parseBookingParts(parts);
  if (!list.length) return null;
  const day = await loadVisitDay(await getDb(), salonUserId, bookingDate);
  const drafted = await draftVisitParts(day, time, list, { prefer });
  const teamByName = new Map(day.team.map((person) => [staffName(person), person]));
  const planned = [];
  for (const part of scheduleBookingParts(time, drafted)) {
    const person = teamByName.get(part.staff);
    const entry = {
      service: part.service,
      minutes: part.minutes,
      start: part.startLabel,
      end: part.endLabel,
      staff: part.staff,
      ...(part.person ? { person: part.person } : {}),
      unknownStaff: Boolean(part.staff && !person),
      free: part.staff && person ? await isStaffFree(day, person, part.start, part.end) : null
    };
    if (withOptions) {
      const skilled = new Set(staffForService(day, part.service).map(staffName));
      entry.options = [];
      for (const member of day.team) {
        entry.options.push({
          name: staffName(member),
          free: await isStaffFree(day, member, part.start, part.end),
          skilled: skilled.has(staffName(member)),
          away: isStaffWorking(member) ? "" : String(member.state || "").trim()
        });
      }
    }
    planned.push(entry);
  }
  let problem = null;
  const unknown = planned.findIndex((part) => part.unknownStaff);
  const busy = planned.findIndex((part) => part.staff && part.free === false);
  if (unknown >= 0) {
    problem = { code: "UNKNOWN_STAFF", partIndex: unknown, message: `«${planned[unknown].staff}» توی تیم سالن نیست.` };
  } else if (busy >= 0) {
    problem = { code: "STAFF_BUSY", partIndex: busy, message: `${planned[busy].staff} از ${planned[busy].start} تا ${planned[busy].end} یه نوبت دیگه داره.` };
  } else if (visitOverlaps(day, time, drafted)) {
    problem = { code: "CONFLICT", partIndex: -1, message: "این ساعت پر شده؛ یه ساعت دیگه بزن." };
  }
  const missing = findUnstaffedPart(day, drafted);
  return { parts: planned, unstaffed: missing ? drafted.indexOf(missing) : -1, problem };
}

/**
 * The artist a client's single-service request at `time` is drafted to (same rules as a visit's
 * services), and whether it must be refused because nobody who could do it is free then.
 */
export async function draftSingleBookingStaff(salonUserId, bookingDate, time, service, minutes) {
  await ensureBookingPartsColumns();
  const day = await loadVisitDay(await getDb(), salonUserId, bookingDate);
  const drafted = await draftVisitParts(day, time, [{ service, minutes, staff: "" }]);
  return { staff: drafted[0]?.staff || "", unstaffed: Boolean(findUnstaffedPart(day, drafted)) };
}

/** The artist-calendar copies of one salon booking (the per-artist rows of a visit, or the single linked one). */
async function bookingCalendarCopyIds(db, salonUserId, booking) {
  if (isMultiPartBooking(booking)) return (await listPartMirrors(db, booking.id)).map((row) => Number(row.id));
  const linked = await findSalonStaffForBooking(salonUserId, booking.staff, booking.service, db);
  const artistId = Number(linked?.artist_user_id || 0);
  if (!artistId) return [];
  const copy = await findLinkedSalonArtistBooking(artistId, salonUserId, booking, db);
  return copy?.id ? [Number(copy.id)] : [];
}

/** A booking's services as plannable parts: its own parts, or the whole booking as one. */
function bookingPlanParts(booking) {
  if (isMultiPartBooking(booking)) return parseBookingParts(booking.parts);
  return [{ service: String(booking.service || "").trim(), minutes: Math.max(15, Number(booking.duration_minutes) || 60), staff: String(booking.staff || "").trim() }];
}

async function loadBookingPlan(salonUserId, id) {
  await ensureBookingPartsColumns();
  const db = await getDb();
  const booking = await get(db, "SELECT * FROM salon_bookings WHERE id = $1 AND salon_user_id = $2", [id, salonUserId]);
  if (!booking) return null;
  const day = await loadVisitDay(db, salonUserId, booking.booking_date, {
    excludeId: booking.id,
    excludeArtistBookingIds: await bookingCalendarCopyIds(db, salonUserId, booking)
  });
  return { booking, day, multi: isMultiPartBooking(booking) };
}

/**
 * «تقسیم خودکار»: the split the system would make for one of the salon's bookings right now,
 * from scratch (who has it now does not count, the booking itself is left out of everyone's day).
 * → { parts } for a visit of several services, { staff } for a single one; null when not the salon's.
 */
export async function suggestBookingStaff(id, salonUserId) {
  const plan = await loadBookingPlan(salonUserId, id);
  if (!plan) return null;
  const drafted = await draftVisitParts(
    plan.day,
    plan.booking.time,
    bookingPlanParts(plan.booking).map((part) => ({ ...part, staff: "" }))
  );
  return plan.multi ? { parts: drafted } : { staff: drafted[0]?.staff || "" };
}

/**
 * For the artist pickers in the booking menu: per service of the booking (in its order, at its
 * own clock time), every team member with whether they are free then (`free`), linked to that
 * service (`skilled`) and away (`away`: their state, when inactive or on leave), plus the
 * split the system suggests. Null when the booking is not the salon's.
 */
export async function listBookingStaffOptions(id, salonUserId) {
  const plan = await loadBookingPlan(salonUserId, id);
  if (!plan) return null;
  const { booking, day } = plan;
  const parts = [];
  for (const part of scheduleBookingParts(booking.time, bookingPlanParts(booking))) {
    const skilled = new Set(staffForService(day, part.service).map(staffName));
    const staff = [];
    for (const person of day.team) {
      staff.push({
        name: staffName(person),
        free: await isStaffFree(day, person, part.start, part.end),
        skilled: skilled.has(staffName(person)),
        away: isStaffWorking(person) ? "" : String(person.state || "").trim()
      });
    }
    parts.push({ service: part.service, start: part.startLabel, end: part.endLabel, staff: part.staff, options: staff });
  }
  const suggested = await draftVisitParts(day, booking.time, bookingPlanParts(booking).map((part) => ({ ...part, staff: "" })));
  return { parts, suggested: suggested.map((part) => part.staff) };
}

/** One of the salon's own booking rows, or null. */
export async function getSalonBookingRow(id, salonUserId) {
  await ensureBookingPartsColumns();
  return get(await getDb(), "SELECT * FROM salon_bookings WHERE id = $1 AND salon_user_id = $2", [id, salonUserId]);
}

/**
 * Where the salon can move one of its bookings on `bookingDate`: of the `candidates` (start
 * times), those at which every service of it -- with the artists it already has -- is free in
 * the salon and in each artist's own calendar, the booking itself and its calendar copies left
 * out. Each comes with its end and how many minutes it runs past `closeMinutes`, so the salon can
 * see a time that only works if it stays longer. Null when the booking is not the salon's.
 */
export async function listBookingMoveTimes(id, salonUserId, bookingDate, candidates, closeMinutes) {
  await ensureBookingPartsColumns();
  const db = await getDb();
  const current = await get(db, "SELECT * FROM salon_bookings WHERE id = $1 AND salon_user_id = $2", [id, salonUserId]);
  if (!current) return null;
  const multi = isMultiPartBooking(current);
  const parts = multi
    ? parseBookingParts(current.parts)
    : [{ service: current.service || "", minutes: Number(current.duration_minutes) || 60, staff: String(current.staff || "").trim() }];
  const held = (await listActiveDayBookings(db, salonUserId, bookingDate, id)).flatMap(bookingSegments);

  // Each artist's own calendar for that day, without this booking's copies in it.
  const busyByStaff = new Map();
  if (multi) {
    const staffList = await listSalonStaff(salonUserId, db);
    const copies = (await listPartMirrors(db, id)).map((row) => Number(row.id));
    for (const name of new Set(parts.map((part) => part.staff).filter(Boolean))) {
      const person = staffList.find((item) => String(item.name || "").trim() === name);
      const artistId = Number(person?.artist_user_id || 0);
      if (artistId) busyByStaff.set(name, await listArtistBusyRanges(artistId, bookingDate, { excludeBookingIds: copies }, db));
    }
  } else {
    const linked = await findSalonStaffForBooking(salonUserId, current.staff, current.service, db);
    const artistId = Number(linked?.artist_user_id || 0);
    if (artistId) {
      const copy = await findLinkedSalonArtistBooking(artistId, salonUserId, current, db);
      busyByStaff.set(parts[0].staff, await listArtistBusyRanges(artistId, bookingDate, { excludeBookingId: copy?.id ?? null }, db));
    }
  }

  const options = [];
  for (const time of candidates) {
    const segments = scheduleBookingParts(time, parts);
    if (!segments.length) continue;
    const taken = segments.some((segment) => (
      held.some((other) => staffScopesConflict(segment.staff, other.staff) && rangesOverlap(segment.start, segment.end, other.start, other.end))
      || (busyByStaff.get(segment.staff) || []).some((range) => rangesOverlap(segment.start, segment.end, range.start, range.end))
    ));
    if (taken) continue;
    const last = segments[segments.length - 1];
    options.push({
      time: normalizeBookingTimeLabel(time),
      end: last.endLabel,
      overtimeMinutes: Math.max(0, last.end - closeMinutes)
    });
  }
  return options;
}
