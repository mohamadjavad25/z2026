import { normalizeBookingTimeLabel, parseServiceDurationMinutes, timeLabelToMinutes } from "./time";
import { joinServiceNames } from "./serviceBundle";
import { toPersianDigits } from "./digits";

// A salon booking with several services (one visit, back to back) keeps them in
// salon_bookings.parts: [{ service, minutes, staff }] in visit order. Each part's
// clock time is not stored -- it follows from the booking's start time and the
// order. A booking with no parts (or one) is an ordinary single-service booking.
export const MAX_BOOKING_PARTS = 8;
// A request for a group (owner's decision 2026-10-22): up to this many people at the same time, each
// with the same services. Their parts sit in one list, person by person; `person` (0, 1, 2) is the
// lane a part runs in, and every lane starts at the booking's start time.
export const MAX_GROUP_PEOPLE = 3;

export function parseBookingParts(value) {
  let list = value;
  if (typeof value === "string") {
    if (!value.trim()) return [];
    try {
      list = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((part) => ({
      service: String(part?.service || "").trim(),
      minutes: Math.max(15, Number(part?.minutes) || parseServiceDurationMinutes(part?.duration)),
      staff: String(part?.staff || "").trim(),
      ...(Number(part?.person) > 0 ? { person: Math.min(MAX_GROUP_PEOPLE - 1, Math.floor(Number(part.person))) } : {})
    }))
    .filter((part) => part.service)
    .slice(0, MAX_BOOKING_PARTS);
}

export function serializeBookingParts(parts) {
  const list = parseBookingParts(parts);
  return list.length >= 2 ? JSON.stringify(list) : "";
}

export function isMultiPartBooking(booking) {
  return parseBookingParts(booking?.parts).length >= 2;
}

/** How many people the parts are for: one, or a group asking together (see MAX_GROUP_PEOPLE). */
export function bookingPeople(booking) {
  const list = Array.isArray(booking) ? booking : parseBookingParts(booking?.parts);
  return list.reduce((most, part) => Math.max(most, (part.person || 0) + 1), 1);
}

/** One person's services as the parts of `people` people at the same time (person 0 first). */
export function expandPartsForPeople(parts, people) {
  const count = Math.max(1, Math.min(MAX_GROUP_PEOPLE, Math.floor(Number(people)) || 1));
  const list = parseBookingParts(parts).map(({ person: _person, ...part }) => part);
  if (count < 2) return list;
  return Array.from({ length: count }, (_, person) => list.map((part) => ({ ...part, ...(person ? { person } : {}) }))).flat();
}

/** "۲ نفر" for a group's booking; "" for one person. */
export function peopleLabel(booking) {
  const people = bookingPeople(booking);
  return people > 1 ? `${toPersianDigits(people)} نفر` : "";
}

/**
 * The booking's service text and total length for these parts. A group's length is the longest
 * person's (they run side by side) and its text names one person's services and the head count.
 */
export function summarizeBookingParts(parts) {
  const list = parseBookingParts(parts);
  const people = bookingPeople(list);
  const first = people > 1 ? list.filter((part) => !part.person) : list;
  const lane = (person) => list.filter((part) => (part.person || 0) === person).reduce((sum, part) => sum + part.minutes, 0);
  const service = joinServiceNames(first.map((part) => part.service));
  return {
    service: people > 1 ? `${service} · ${toPersianDigits(people)} نفر` : service,
    durationMinutes: Math.max(...Array.from({ length: people }, (_, person) => lane(person)), 0)
  };
}

function minutesToLabel(total) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Each part with its start/end (minutes from midnight, and "HH:MM"), in visit order. */
export function scheduleBookingParts(startTime, parts) {
  const begin = timeLabelToMinutes(normalizeBookingTimeLabel(startTime || ""));
  const cursors = new Map();
  return parseBookingParts(parts).map((part, index) => {
    const lane = part.person || 0;
    const start = cursors.has(lane) ? cursors.get(lane) : begin;
    const cursor = start + part.minutes;
    cursors.set(lane, cursor);
    return { ...part, index, start, end: cursor, startLabel: minutesToLabel(start), endLabel: minutesToLabel(cursor) };
  });
}

/**
 * Back-to-back parts done by the same person, as one block each: what lands in that
 * artist's own schedule as a single appointment.
 */
export function groupConsecutiveParts(startTime, parts) {
  const groups = [];
  for (const part of scheduleBookingParts(startTime, parts)) {
    const last = groups[groups.length - 1];
    if (last && last.staff === part.staff && last.end === part.start) {
      last.parts.push(part);
      last.end = part.end;
      last.endLabel = part.endLabel;
    } else {
      groups.push({ staff: part.staff, start: part.start, end: part.end, startLabel: part.startLabel, endLabel: part.endLabel, parts: [part] });
    }
  }
  return groups.map((group) => ({
    ...group,
    minutes: group.end - group.start,
    service: joinServiceNames(group.parts.map((part) => part.service))
  }));
}
