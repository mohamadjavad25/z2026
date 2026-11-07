import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// The sheet sits in every home screen, also closed. Working out a year of days while closed froze the page for everyone,
// clients too (browser tests caught it before it shipped).
const built = vi.hoisted(() => ({ count: 0 }));
vi.mock("../../app/features/artist/bookingUtils", async (original) => {
  const real = await original();
  return { ...real, buildExactBookingDateTabs: (...args) => { built.count += 1; return real.buildExactBookingDateTabs(...args); } };
});
vi.mock("../../app/features/shell/HomeContext", () => ({
  useHome: () => ({ bookingSheetOpen: false, createdProfile: { type: "client" }, salonServiceList: [], artistServiceList: [], salonHoursList: [] })
}));
const { OwnerBookingSheet } = await import("../../app/features/shell/home/OwnerBookingSheet.jsx");

describe("the owner's booking sheet while closed", () => {
  it("draws nothing and works out no days", () => {
    expect(renderToStaticMarkup(createElement(OwnerBookingSheet))).toBe("");
    expect(built.count).toBe(0);
  });
});
