import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildPersianMonthGrid, formatPersianDateKey, getPersianDateParts, isWithinRollingWeek } from "../../app/shared/lib/persianCalendar.js";
import { getArtistBookingSortKey, isArtistBookingOnExactDate, sortArtistBookingsNearest } from "../../app/features/artist/bookingUtils.js";

// The sheet draws through a portal, which needs a browser; here it just draws what is inside.
vi.mock("../../app/features/profile/ProfileSheet", () => ({ ProfileSheet: ({ open, children }) => (open ? children : null) }));
const { BookingWeekRail } = await import("../../app/features/profile/BookingWeekRail.jsx");

const DAY_MS = 24 * 60 * 60 * 1000;
const today = getPersianDateParts(new Date());
const cells = buildPersianMonthGrid(today.year, today.month).filter(Boolean);
// A day of this month outside the next seven: the calendar counted only those seven, so a booking here read as none.
const outside = cells.find((cell) => !isWithinRollingWeek(cell.date));
const rail = (bookings) => renderToStaticMarkup(createElement(BookingWeekRail, {
  historyOpen: true,
  bookings,
  matchBookingDay: (booking, _day, dateKey) => isArtistBookingOnExactDate(booking, dateKey),
  renderBooking: (booking) => createElement("p", null, booking.client)
}));

describe("the salon's month calendar", () => {
  it("marks a day with a booking outside this week", () => {
    const html = rail([{ id: 1, date: outside.key, dateKey: outside.key, time: "10:00", client: "مشتری" }]);
    expect(html).toContain("has-bookings");
    expect(html).toContain(`${outside.weekday} ${outside.dayLabel}، ۱ نوبت`);
  });

  it("says an empty month in words, not with a zero that reads as a dot", () => {
    const html = rail([]);
    expect(html).not.toContain("has-bookings");
    expect(html).toContain("بدون نوبت");
    expect(html).not.toContain("۰ نوبت</b>");
  });
});

describe("nearest bookings first", () => {
  const key = (days) => formatPersianDateKey(new Date(Date.now() + days * DAY_MS));

  it("orders far dates by their day, not by the hour alone", () => {
    const near = { id: "near", date: key(10), time: "18:00" };
    const far = { id: "far", date: key(40), time: "09:00" };
    expect(sortArtistBookingsNearest([far, near]).map((item) => item.id)).toEqual(["near", "far"]);
  });

  it("keeps today before a far date", () => {
    expect(getArtistBookingSortKey({ date: "امروز", time: "20:00" })).toBeLessThan(getArtistBookingSortKey({ date: key(30), time: "09:00" }));
  });
});
