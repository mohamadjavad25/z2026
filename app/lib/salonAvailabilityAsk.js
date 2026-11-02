import { MAX_BOOKING_PARTS, MAX_GROUP_PEOPLE } from "../shared/lib/bookingParts.js";
import { onlineBookingBlock } from "./billing/access.js";
import { availabilityKey, cachedAvailability } from "./availabilityCache.js";
import { computeSalonFreeTimes } from "./salonFreeTimes.js";

/**
 * What a «which times are free» question asks, read from the query string the same way for one day
 * (GET /api/salon-bookings/availability) and for several (…/availability/days):
 * salonUserId, service (1 to MAX_BOOKING_PARTS, in order), minutes (one per service, used only for a
 * service the salon does not list), people (a client's group, 1 to 3) and prefer (a client's «رزرو با …»).
 * → { ok: true, ask } or { ok: false, error }.
 */
export function readAvailabilityAsk(searchParams, user) {
  const salonUserId = Number(searchParams.get("salonUserId"));
  if (!salonUserId) return { ok: false, error: "این سالن رو پیدا نکردیم." };
  const names = searchParams.getAll("service").map((name) => name.trim()).filter(Boolean);
  if (!names.length || names.length > MAX_BOOKING_PARTS || names.some((name) => name.length > 120)) {
    return { ok: false, error: "کارها درست نرسید؛ دوباره انتخاب کن." };
  }
  const minutes = searchParams.getAll("minutes").map(Number);
  const isClient = user.type === "client";
  // A group (2 or 3 people at the same time, a client's request only) needs that many artists free together.
  const people = isClient ? Math.max(1, Math.min(MAX_GROUP_PEOPLE, Math.floor(Number(searchParams.get("people"))) || 1)) : 1;
  const prefer = isClient && people < 2 ? String(searchParams.get("prefer") || "").trim().slice(0, 120) : "";
  if (names.length * people > MAX_BOOKING_PARTS) return { ok: false, error: "کارها درست نرسید؛ دوباره انتخاب کن." };
  return { ok: true, ask: { salonUserId, names, minutes, isClient, people, prefer } };
}

/** A salon that takes no new requests (suspended, or its subscription closed) offers no free times to anyone but itself. */
export async function salonClosedToViewer(ask, user) {
  return user.id !== ask.salonUserId && Boolean(await onlineBookingBlock(ask.salonUserId, "salon"));
}

/**
 * The free times of one day for this ask. The same salon, day and services asked within a few seconds share one
 * answer (see availabilityCache.js); it only decides what a page shows, booking itself re-checks under row locks.
 * → { data: { times, durationMinutes } } or { error, status }.
 */
export function freeTimesForDay(ask, dayKey) {
  const { salonUserId, names, minutes, isClient, people, prefer } = ask;
  const key = availabilityKey(salonUserId, dayKey, [
    ...names.map((service, index) => ({ service, minutes: minutes[index] || 0 })),
    ...(people > 1 ? [{ service: "people", minutes: people }] : []),
    ...(prefer ? [{ service: `prefer:${prefer}`, minutes: 0 }] : [])
  ], isClient);
  return cachedAvailability(salonUserId, key, () => computeSalonFreeTimes(salonUserId, dayKey, names, minutes, isClient, people, prefer));
}
