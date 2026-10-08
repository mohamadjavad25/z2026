import { json, requireUserRole, withErrorHandling } from "../../../lib/http.js";
import * as salons from "../../../lib/db/repos/salons.js";
import * as artists from "../../../lib/db/repos/artists.js";
import { formatPersianDateKey, resolveRollingPersianDateKey } from "../../../shared/lib/persianCalendar.js";

export const runtime = "nodejs";

/**
 * GET /api/salon-staff/calendars → { calendars: [{ staff, breakTime, bookedSlots }] }
 *
 * Busy times of the salon's team members who have their own artist account: their daily break and
 * their upcoming bookings (from any source, not just this salon). The owner's booking sheet uses it
 * to hide times POST /api/salon-bookings would refuse (isArtistSlotBlocked). Only when/how long is
 * shared, never who the customer is.
 */
async function _GET(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const todayKey = formatPersianDateKey(new Date());
  const staff = await salons.listSalonStaff(auth.user.id);
  const calendars = await Promise.all(staff
    .filter((person) => person.artist_user_id && person.name)
    .map(async (person) => {
      const artistUserId = Number(person.artist_user_id);
      const [breakTime, booked] = await Promise.all([
        artists.getArtistBreak(artistUserId),
        artists.listArtistBookedSlots(artistUserId)
      ]);
      return {
        staff: String(person.name).trim(),
        breakTime,
        bookedSlots: booked
          // Same date resolution as isArtistSlotBlocked, done once here.
          .map((slot) => ({
            booking_date: resolveRollingPersianDateKey(slot.booking_date),
            time: slot.time,
            duration_minutes: slot.duration_minutes
          }))
          .filter((slot) => slot.booking_date >= todayKey)
      };
    }));
  return json({ data: { calendars } });
}

export const GET = withErrorHandling(_GET);
