import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildExactBookingDateTabs } from "../../app/features/artist/bookingUtils.js";
import { VISIT_DAYS_STEP, visitDaysShown } from "../../app/features/booking/visitBookerModel.js";
import { VisitDayTiles } from "../../app/features/booking/VisitWizard.jsx";
import { OWNER_VISIT_DAYS } from "../../app/features/shell/home/OwnerBookingSheet.jsx";

// A real artist's week was full and they could not enter a client for next week: the form stopped at seven days,
// although a salon or an artist may enter any date themselves (decision of 2026-10-25).
const days = buildExactBookingDateTabs(OWNER_VISIT_DAYS).map((tab) => ({ value: tab.dateKey, label: `${tab.label} ${tab.sub}`.trim() }));
const tiles = (value) => renderToStaticMarkup(createElement(VisitDayTiles, { days, value, onPick: () => {} }));
const tileCount = (html) => (html.match(/vbDayCard/g) || []).length;

describe("the day step of the salon's and artist's booking form", () => {
  it("reaches past this week, a year ahead", () => {
    expect(days.length).toBeGreaterThanOrEqual(365);
    expect(new Set(days.map((day) => day.value)).size).toBe(days.length);
  });

  it("shows next week straight away, and offers the days after", () => {
    const html = tiles(days[0].value);
    expect(tileCount(html)).toBe(VISIT_DAYS_STEP);
    expect(html).toContain(days[0].label.split(" ").slice(1).join(" "));
    expect(html).toContain(days[10].label.split(" ").slice(1).join(" "));
    expect(html).toContain("روزهای بعد");
  });

  it("always shows the chosen day, even far ahead", () => {
    expect(visitDaysShown(days, days[0].value)).toBe(VISIT_DAYS_STEP);
    expect(visitDaysShown(days, days[VISIT_DAYS_STEP - 1].value)).toBe(VISIT_DAYS_STEP);
    expect(visitDaysShown(days, days[VISIT_DAYS_STEP].value)).toBe(VISIT_DAYS_STEP * 2);
    expect(tiles(days[100].value)).toContain("is-on");
  });

  it("has no «روزهای بعد» when every day is already there", () => {
    const short = days.slice(0, 7);
    const html = renderToStaticMarkup(createElement(VisitDayTiles, { days: short, value: short[0].value, onPick: () => {} }));
    expect(tileCount(html)).toBe(7);
    expect(html).not.toContain("روزهای بعد");
  });
});
