/**
 * Who does what in a visit: one salon day loaded once (loadVisitDay), and the draft that hands each service without an
 * artist to a free team member (draftVisitParts). The client's time list, the salon's preview and the booking itself
 * all use this one draft, so a time shown as free is a time that is accepted.
 */
import { listArtistBusyRanges } from "../../artists/calendar.js";
import { currentTerms, termsAllow } from "../../teamAgreements.js";
import { getPersianWeekday, persianDateKeyToDate, resolveRollingPersianDateKey } from "../../../../../shared/lib/persianCalendar.js";
import { rangesOverlap } from "../../../../../shared/lib/time.js";
import { bookingPeople, scheduleBookingParts } from "../../../../../shared/lib/bookingParts.js";
import { listSalonServices } from "../services.js";
import { listSalonStaff } from "../staff.js";
import { bookingSegments, listActiveDayBookings, staffScopesConflict } from "./day.js";

// A team member who has turned themselves off ("غیرفعال") or is on leave gets no new work drafted.
const STAFF_AWAY_STATES = new Set(["غیرفعال", "مرخصی"]);

export function isStaffWorking(person) {
  return !STAFF_AWAY_STATES.has(String(person?.state || "").trim());
}

export const staffName = (person) => String(person?.name || "").trim();

/**
 * Everything a visit plan needs for one salon day, loaded once: the salon's services (with who
 * does each), its team, its active bookings (and how many minutes each member already has that
 * day), and -- loaded as first needed -- each artist's own calendar. `excludeId` /
 * `excludeArtistBookingIds` leave one booking and its calendar copies out, for re-planning it.
 */
export async function loadVisitDay(db, salonUserId, bookingDate, { excludeId = null, excludeArtistBookingIds = [] } = {}) {
  const services = await listSalonServices(salonUserId, db);
  const team = (await listSalonStaff(salonUserId, db)).filter(staffName);
  const rows = await listActiveDayBookings(db, salonUserId, bookingDate, excludeId);
  const held = rows.flatMap(bookingSegments);
  const load = new Map();
  for (const segment of held) {
    if (segment.staff) load.set(segment.staff, (load.get(segment.staff) || 0) + segment.end - segment.start);
  }
  return { db, salonUserId, bookingDate, services, team, rows, held, load, artistBusy: new Map(), agreed: new Map(), excludeArtistBookingIds };
}

async function artistBusyRanges(day, artistId) {
  if (!day.artistBusy.has(artistId)) {
    day.artistBusy.set(artistId, await listArtistBusyRanges(artistId, day.bookingDate, { excludeBookingIds: day.excludeArtistBookingIds || [] }, day.db));
  }
  return day.artistBusy.get(artistId);
}

/**
 * An entry the salon typed in without an artist's name still takes one seat. How many seats such entries need at
 * once between `start` and `end` (the busiest minute), so a client is not put on the last free artist.
 */
function unassignedSeats(day, start, end) {
  const inside = day.held.filter((segment) => !segment.staff && rangesOverlap(start, end, segment.start, segment.end));
  let most = 0;
  for (const point of new Set(inside.map((segment) => Math.max(start, segment.start)))) {
    most = Math.max(most, inside.filter((segment) => segment.start <= point && point < segment.end).length);
  }
  return most;
}

export function staffForService(day, serviceName) {
  const service = day.services.find((item) => String(item.name || "").trim() === serviceName);
  return (service?.staff_members || []).filter(staffName);
}

/**
 * Who may be drafted for a service: the working members linked to it, or -- when it has none
 * (nobody linked, or all of them away) -- anyone on the team who is working. The salon can
 * always hand it to someone else afterwards.
 */
function draftPool(day, serviceName) {
  const linked = staffForService(day, serviceName).filter(isStaffWorking);
  return linked.length ? linked : day.team.filter(isStaffWorking);
}

/** Free from `start` to `end`: nothing of theirs in this salon then, nor in their own artist calendar. */
export async function isStaffFree(day, person, start, end) {
  const name = staffName(person);
  if (day.held.some((segment) => segment.staff === name && rangesOverlap(start, end, segment.start, segment.end))) return false;
  const artistId = Number(person.artist_user_id || 0);
  if (artistId && (await artistBusyRanges(day, artistId)).some((range) => rangesOverlap(start, end, range.start, range.end))) return false;
  // The days and hours the two agreed (owner's decision 2026-10-28); an old text-only agreement limits nothing.
  if (artistId && !(await agreedTermsAllow(day, artistId, start, end))) return false;
  return true;
}

async function agreedTermsAllow(day, artistId, start, end) {
  if (!day.agreed.has(artistId)) day.agreed.set(artistId, await currentTerms(day.salonUserId, artistId, resolveRollingPersianDateKey(day.bookingDate), day.db));
  const date = persianDateKeyToDate(resolveRollingPersianDateKey(day.bookingDate));
  return termsAllow(day.agreed.get(artistId), day.bookingDate, date ? getPersianWeekday(date) : "", start, end);
}

function compareRanks(a, b) {
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

/**
 * Draft split of a visit: each service without an artist goes to a free member of its pool
 * (draftPool). Of those free, the work is spread: whoever has the fewest minutes of this visit
 * so far, then whoever did the service right before (one hand-over fewer), then whoever has the
 * least booked that day, then the salon's own order. A service nobody can take stays unassigned.
 */
/**
 * `prefer` is a team member's name a client asked for («رزرو با …» on the salon page, owner's decision 2026-10-26):
 * a service with no artist named then goes to that person only, under the same rules (free then, seats left); if
 * they cannot take it the service stays unstaffed, so the time is not offered and a request for it is refused.
 */
export async function draftVisitParts(day, time, parts, { prefer = "" } = {}) {
  const drafted = [];
  const visitMinutes = new Map();
  // What this visit has already given each artist (a group's people run side by side: one artist cannot be two of them).
  const taken = [];
  const takenBy = (name, start, end) => taken.some((item) => item.staff === name && rangesOverlap(start, end, item.start, item.end));
  let previous = "";
  let previousPerson = 0;
  for (const part of scheduleBookingParts(time, parts)) {
    let staff = part.staff;
    if (previousPerson !== (part.person || 0)) {
      previous = "";
      previousPerson = part.person || 0;
    }
    if (!staff) {
      let best = null;
      // The one asked for, if this service is theirs (the same pool the draft takes from: linked, else anyone).
      const pool = prefer
        ? draftPool(day, part.service).filter((person) => staffName(person) === prefer)
        : draftPool(day, part.service);
      // The seats at this hour: working team members free then, less those the salon's unassigned entries take.
      let freeSeats = 0;
      for (const person of day.team) {
        if (isStaffWorking(person) && !takenBy(staffName(person), part.start, part.end) && (await isStaffFree(day, person, part.start, part.end))) freeSeats += 1;
      }
      const seatsLeft = freeSeats - unassignedSeats(day, part.start, part.end);
      for (let order = 0; seatsLeft > 0 && order < pool.length; order += 1) {
        const person = pool[order];
        if (takenBy(staffName(person), part.start, part.end)) continue;
        if (!(await isStaffFree(day, person, part.start, part.end))) continue;
        const name = staffName(person);
        const rank = [visitMinutes.get(name) || 0, name === previous ? 0 : 1, day.load.get(name) || 0, order];
        if (!best || compareRanks(rank, best.rank) < 0) best = { name, rank };
      }
      staff = best?.name || "";
    }
    if (staff) {
      visitMinutes.set(staff, (visitMinutes.get(staff) || 0) + part.minutes);
      taken.push({ staff, start: part.start, end: part.end });
    }
    previous = staff;
    drafted.push({ service: part.service, minutes: part.minutes, staff, ...(part.person ? { person: part.person } : {}) });
  }
  return drafted;
}

/**
 * The first service left without an artist although someone at the salon could do it. A salon that has a team
 * but where nobody is working (all on leave or switched off) counts too: a request is never accepted for nobody.
 */
export function findUnstaffedPart(day, parts) {
  const missing = parts.find((part) => !part.staff && (draftPool(day, part.service).length || day.team.length));
  if (missing) return missing;
  // A group needs a seat each; a salon with no team on the system has one (nobody to draft, so nobody is "unstaffed" above).
  if (bookingPeople(parts) > 1 && !day.team.length) return parts.find((part) => part.person) || parts[0];
  return null;
}

/** Same rule as findOverlapConflict, against an already loaded day (each drafted part with its own artist). */
export function visitOverlaps(day, time, parts) {
  const wanted = scheduleBookingParts(time, parts).map((part) => ({ staff: part.staff, start: part.start, end: part.end }));
  return day.held.some((held) => wanted.some((segment) => staffScopesConflict(segment.staff, held.staff)
    && rangesOverlap(segment.start, segment.end, held.start, held.end)));
}
