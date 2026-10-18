import { describe, it, expect } from "vitest";
import {
  BOOKING_REQUEST_LEAD_MINUTES,
  bookingWaitMinutes,
  isTooSoonToRequest,
  minutesUntilSlotStart,
  requestDeadlineLabel,
  requestMinutesLeft,
  requestRemainingShare
} from "../../app/shared/lib/bookingWindow.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";

// 10:00 Tehran (UTC+3:30) = 06:30 UTC.
const now = new Date("2026-10-15T06:30:00Z");
const today = formatPersianDateKey(now);
const tomorrow = formatPersianDateKey(new Date(now.getTime() + 86400000));
const sentAt = (minutesAgo) => new Date(now.getTime() - minutesAgo * 60000).toISOString();

describe("minutesUntilSlotStart", () => {
  it("counts minutes on the same day, negative once started", () => {
    expect(minutesUntilSlotStart(today, "۱۰:۴۵", now)).toBe(45);
    expect(minutesUntilSlotStart(today, "09:30", now)).toBe(-30);
  });
  it("is infinite for other days and null for nonsense", () => {
    expect(minutesUntilSlotStart(tomorrow, "00:15", now)).toBe(Infinity);
    expect(minutesUntilSlotStart("", "10:00", now)).toBeNull();
  });
});

describe("isTooSoonToRequest", () => {
  it("refuses a slot that starts inside the lead time, accepts the edge", () => {
    expect(isTooSoonToRequest(today, "10:10", now)).toBe(true);
    expect(isTooSoonToRequest(today, "09:00", now)).toBe(true);
    expect(isTooSoonToRequest(today, "10:29", now)).toBe(true);
    expect(isTooSoonToRequest(today, "10:30", now)).toBe(false);
    expect(BOOKING_REQUEST_LEAD_MINUTES).toBe(30);
  });
  it("never blocks a later day", () => {
    expect(isTooSoonToRequest(tomorrow, "00:15", now)).toBe(false);
  });
});

describe("requestMinutesLeft", () => {
  it("is the hour window when the slot is far off", () => {
    expect(requestMinutesLeft(sentAt(10), tomorrow, "11:00", { now })).toBe(50);
  });
  it("is cut short by the slot start (the case that surprised owners)", () => {
    // sent 5 minutes ago for 10:15 -> 15 minutes left (the slot start), not 55.
    expect(requestMinutesLeft(sentAt(5), today, "10:15", { now })).toBe(15);
    expect(requestDeadlineLabel(sentAt(5), today, "10:15", { now })).toBe("۱۰:۱۵");
  });
  it("is over once the slot has started, whatever the window says", () => {
    expect(requestMinutesLeft(sentAt(1), today, "09:50", { now })).toBeLessThanOrEqual(0);
  });
  it("is over after a past day", () => {
    const yesterday = formatPersianDateKey(new Date(now.getTime() - 86400000));
    expect(requestMinutesLeft(sentAt(1), yesterday, "20:00", { now })).toBeLessThanOrEqual(0);
  });
  it("falls back to the window alone without day/time, and to null with nothing", () => {
    expect(requestMinutesLeft(sentAt(20), "", "", { now })).toBe(40);
    expect(requestMinutesLeft("", "", "", { now })).toBeNull();
  });
  it("shows the window deadline as Tehran clock when the slot is later", () => {
    // sent 10:00 Tehran + 60 = 11:00
    expect(requestDeadlineLabel(sentAt(0), tomorrow, "12:00", { now })).toBe("۱۱:۰۰");
  });
});

describe("requestRemainingShare", () => {
  it("runs 1 -> 0 over the whole wait", () => {
    expect(requestRemainingShare(sentAt(0), tomorrow, "12:00", { now })).toBe(1);
    expect(requestRemainingShare(sentAt(30), tomorrow, "12:00", { now })).toBeCloseTo(0.5, 2);
    expect(requestRemainingShare(sentAt(70), tomorrow, "12:00", { now })).toBe(0);
  });
  it("uses the shortened wait when the slot is close", () => {
    // sent 09:50 for a 10:10 slot: the whole wait is 20 minutes, 10 are left.
    expect(requestRemainingShare(sentAt(10), today, "10:10", { now })).toBeCloseTo(0.5, 2);
  });
});

describe("a request with no window (the client waits until the appointment)", () => {
  it("has only the slot start as its limit", () => {
    expect(requestMinutesLeft(sentAt(120), today, "11:00", { now, windowMinutes: null })).toBe(60);
    expect(requestDeadlineLabel(sentAt(120), today, "11:00", { now, windowMinutes: null })).toBe("۱۱:۰۰");
    expect(requestMinutesLeft(sentAt(120), tomorrow, "11:00", { now, windowMinutes: null })).toBeNull();
  });
  it("reads the window from the booking, old rows keeping the hour", () => {
    expect(bookingWaitMinutes({ wait_minutes: null })).toBeNull();
    expect(bookingWaitMinutes({ wait_minutes: 60 })).toBe(60);
    expect(bookingWaitMinutes({ waitMinutes: null })).toBeNull();
    expect(bookingWaitMinutes({})).toBe(60);
  });
});
