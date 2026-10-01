import { parseTomanAmount } from "../../shared/lib/money";
import { getBookingDateOffsetDays } from "../artist/bookingUtils";
import { resolveRollingPersianDateKey } from "../../shared/lib/persianCalendar";

export const STAFF_STATS_WEEKS = 6;
const UNCOUNTED_STATUSES = new Set(["لغو", "منقضی شده", "درخواست"]);

function offsetForBooking(booking, cache) {
  const raw = String(booking?.booking_date || booking?.date || "").trim() || "امروز";
  if (!cache.has(raw)) {
    cache.set(raw, getBookingDateOffsetDays(resolveRollingPersianDateKey(raw)));
  }
  return cache.get(raw);
}

/**
 * Per-artist activity for the salon dashboard, derived purely from the
 * salon's own bookings + service prices (no extra endpoint): weekly income
 * and booking counts for the last N weeks, top services, cancel rate and
 * how many upcoming bookings are on the books. `weeks[0]` is the oldest.
 */
export function computeStaffStats(staff, appointments = [], services = []) {
  const names = new Set(
    [staff?.name, staff?.artist_name].map((value) => String(value || "").trim()).filter(Boolean)
  );
  const priceByService = new Map(
    services.map((service) => [String(service.name || "").trim(), parseTomanAmount(service.price)])
  );
  const cache = new Map();
  const weeks = Array.from({ length: STAFF_STATS_WEEKS }, () => ({ income: 0, bookings: 0 }));
  const byService = new Map();
  let total = 0;
  let cancelled = 0;
  let upcoming = 0;
  let income = 0;

  for (const booking of appointments) {
    if (!names.has(String(booking?.staff || "").trim())) continue;
    total += 1;
    if (UNCOUNTED_STATUSES.has(booking.status)) {
      if (booking.status === "لغو") cancelled += 1;
      continue;
    }
    const offset = offsetForBooking(booking, cache);
    if (offset > 0) {
      upcoming += 1;
      continue;
    }
    const weekAgo = Math.floor(-offset / 7);
    if (weekAgo >= STAFF_STATS_WEEKS) continue;
    const price = priceByService.get(String(booking.service || "").trim()) || 0;
    const bucket = weeks[STAFF_STATS_WEEKS - 1 - weekAgo];
    bucket.bookings += 1;
    bucket.income += price;
    income += price;
    const entry = byService.get(booking.service || "خدمت") || { name: booking.service || "خدمت", count: 0, income: 0 };
    entry.count += 1;
    entry.income += price;
    byService.set(entry.name, entry);
  }

  const completed = weeks.reduce((sum, week) => sum + week.bookings, 0);
  return {
    weeks,
    income,
    completed,
    upcoming,
    cancelRate: total ? Math.round((cancelled / total) * 100) : 0,
    topServices: [...byService.values()].sort((a, b) => b.count - a.count).slice(0, 3),
    hasData: total > 0
  };
}
