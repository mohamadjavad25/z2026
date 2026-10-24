import { findSalonHourForWeekday, isSalonHourOpen, salonDayWindow, weekdayOfDateKey } from "./salonAvailability.js";
import { timeLabelToMinutes } from "./time.js";

/**
 * Where a client's booking with an artist on salon teams is received (owner's idea of 2026-10-24, second version).
 * The client never chooses. The artist keeps an ordered list of their salons; the booking goes to the first salon in
 * the list that can take it, and when none can it stays where the artist always worked («مثل قبل») or waits for the
 * artist to say. One pure place for the rule, used by the server when a booking is made and by the artist's list screen,
 * so what is shown is what the server does.
 *
 * A candidate is one salon of the list: { salonUserId, state, allowed, hours, used }
 *   state    the member's state in that salon's team («فعال» / «غیرفعال» / «مرخصی»);
 *   allowed  the salon's switch «نوبت مستقیم توی سالن» for this member;
 *   hours    the salon's weekly hours rows (day, open_time, close_time, capacity, active);
 *   used     how many bookings the salon already holds on that date (its own and the direct ones).
 */

export const PLACE_FALLBACKS = ["own", "ask"];
const AWAY_STATES = new Set(["غیرفعال", "مرخصی"]);

/** Why a salon cannot take this booking: 'away' | 'blocked' | 'closed' | 'outside' | 'full'; '' when it can. */
export function placeBlock(candidate, { dateKey, time, minutes = 60 } = {}) {
  if (AWAY_STATES.has(String(candidate.state || "").trim())) return "away";
  if (candidate.allowed === false) return "blocked";
  const row = findSalonHourForWeekday(candidate.hours || [], weekdayOfDateKey(dateKey) || dateKey);
  if (!isSalonHourOpen(row)) return "closed";
  const window = salonDayWindow(row);
  const start = timeLabelToMinutes(time);
  if (start < timeLabelToMinutes(window.open) || start + Number(minutes || 60) > timeLabelToMinutes(window.close)) return "outside";
  const capacity = row ? Number(row.capacity) : NaN;
  if (Number.isFinite(capacity) && Number(candidate.used || 0) >= capacity) return "full";
  return "";
}

/** The first salon of the list that can take the booking, or null (then the artist's fallback decides). */
export function pickPlace(candidates, booking) {
  return (candidates || []).find((candidate) => !placeBlock(candidate, booking)) || null;
}

/** The salon in the artist's list as the artist reads it: nothing to worry about, or why it is skipped for now. */
export function placeNote(candidate, salonName = "سالن") {
  if (AWAY_STATES.has(String(candidate.state || "").trim())) return `الان توی ${salonName} نیستی (مرخصی یا غیرفعال). نوبتی اونجا نمی‌افته.`;
  if (candidate.allowed === false) return `${salonName} نوبت مستقیم رو بسته. نوبتی اونجا نمی‌افته.`;
  return "";
}
