import { normalizeBookingTimeLabel, parseServiceDurationMinutes, timeLabelToMinutes } from "./time";
import { joinServiceNames } from "./serviceBundle";

// A salon booking with several services (one visit, back to back) keeps them in
// salon_bookings.parts: [{ service, minutes, staff }] in visit order. Each part's
// clock time is not stored -- it follows from the booking's start time and the
// order. A booking with no parts (or one) is an ordinary single-service booking.
export const MAX_BOOKING_PARTS = 8;

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
      staff: String(part?.staff || "").trim()
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

/** The booking's service text and total length for these parts. */
export function summarizeBookingParts(parts) {
  const list = parseBookingParts(parts);
  return {
    service: joinServiceNames(list.map((part) => part.service)),
    durationMinutes: list.reduce((sum, part) => sum + part.minutes, 0)
  };
}

function minutesToLabel(total) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Each part with its start/end (minutes from midnight, and "HH:MM"), in visit order. */
export function scheduleBookingParts(startTime, parts) {
  let cursor = timeLabelToMinutes(normalizeBookingTimeLabel(startTime || ""));
  return parseBookingParts(parts).map((part, index) => {
    const start = cursor;
    cursor += part.minutes;
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
