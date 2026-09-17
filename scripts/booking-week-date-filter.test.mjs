import assert from "node:assert/strict";
import test from "node:test";

import {
  formatPersianDateKey,
  resolveRollingPersianDateKey
} from "../app/shared/lib/persianCalendar.js";

test("weekly booking filters use exact Persian dates, not weekday names", () => {
  const currentSaturday = new Date("2026-08-01T09:00:00+03:30");
  const nextSaturday = new Date(currentSaturday);
  nextSaturday.setDate(currentSaturday.getDate() + 7);

  const currentSaturdayKey = resolveRollingPersianDateKey("شنبه", currentSaturday);
  const nextSaturdayKey = formatPersianDateKey(nextSaturday);
  const bookings = [
    { id: 1, booking_date: currentSaturdayKey, client: "رزرو همین هفته" }
  ];

  assert.notEqual(currentSaturdayKey, nextSaturdayKey);
  assert.equal(
    bookings.filter((booking) => booking.booking_date === currentSaturdayKey).length,
    1
  );
  assert.equal(
    bookings.filter((booking) => booking.booking_date === nextSaturdayKey).length,
    0
  );
});
