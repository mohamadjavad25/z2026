import * as salons from "./db/repos/salons.js";
import { salonVisitParts } from "./salonVisitParts.js";
import { isSlotInPast } from "../shared/lib/slots.js";
import { isTooSoonToRequest } from "../shared/lib/bookingWindow.js";
import { expandPartsForPeople, summarizeBookingParts } from "../shared/lib/bookingParts.js";
import { findSalonHourForDateKey, isSalonHourOpen, salonDayWindow } from "../shared/lib/salonAvailability.js";
import { buildDayBookingSlots } from "../shared/lib/time.js";

/**
 * The start times on `bookingDateKey` at which these services (back to back, for `people` at once) can be asked of the
 * salon: what GET /api/salon-bookings/availability answers, and what «خبرم کن» checks when a time frees up.
 * Returns { data: { times, durationMinutes } } or { error, status }.
 */
export async function computeSalonFreeTimes(salonUserId, bookingDateKey, names, minutes, isClient, people = 1, prefer = "") {
  const salon = await salons.getSalon(salonUserId);
  if (!salon) return { error: "سالن پیدا نشد.", status: 404 };
  const single = salonVisitParts(salon, names.map((service, index) => ({ service, durationMinutes: minutes[index] })));
  const parts = people > 1 ? expandPartsForPeople(single, people) : single;
  const missing = single.find((part, index) => !part.listed && !(minutes[index] > 0));
  if (missing) return { error: `«${missing.service}» در خدمات این سالن نیست.`, status: 400 };

  const { durationMinutes } = summarizeBookingParts(parts);
  const hour = findSalonHourForDateKey(await salons.listSalonHours(salonUserId), bookingDateKey);
  let times = [];
  if (isSalonHourOpen(hour)) {
    const window = salonDayWindow(hour);
    const candidates = buildDayBookingSlots(window.open, window.close, durationMinutes)
      .filter((time) => !isSlotInPast(bookingDateKey, time))
      // Same rule POST enforces for a client: the salon needs time to answer.
      .filter((time) => !isClient || !isTooSoonToRequest(bookingDateKey, time));
    times = await salons.listFeasibleVisitTimes(salonUserId, bookingDateKey, parts, candidates, { prefer });
  }
  return { data: { times, durationMinutes } };
}
