import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";

globalThis.React = React;
const h = React.createElement;

let adminData = null;
vi.mock("../../app/admin/ui", () => ({
  useAdminData: () => ({ data: adminData, error: "", reload: () => {} }),
  Card: ({ title, children }) => h("section", null, h("h3", null, title), children),
  ErrorNote: () => h("p", null, "error"),
  Loading: () => h("p", null, "loading")
}));

const { UserFootprint } = await import("../../app/admin/UserFootprint.jsx");
const { ActivityReport } = await import("../../app/admin/ActivityReport.jsx");
const { activityLabel, durationLabel, sourceLabel } = await import("../../app/admin/activityLabels.js");

describe("the footprint's admin views", () => {
  it("says so when a person has no footprint yet", () => {
    adminData = { totals: { visits: 0, seconds: 0 }, visits: [], page: { viewers: 0, book_taps: 0 } };
    const html = renderToStaticMarkup(h(UserFootprint, { userId: 1, provider: true }));
    expect(html).toContain("هنوز رد پایی ثبت نشده.");
    expect(html).toContain("صفحهٔ عمومیش");
  });

  it("shows a visit in words, and an unknown name as it is", () => {
    adminData = {
      totals: { visits: 1, seconds: 4200 },
      page: { viewers: 7, book_taps: 2 },
      visits: [{
        id: "v", device: "android-app", source: "l.instagram.com", started_at: "2026-11-05T05:08:00Z", last_at: "2026-11-05T06:18:00Z",
        events: [{ kind: "action", name: "register", at: "2026-11-05T05:08:00Z" }, { kind: "screen", name: "tab:new", at: "2026-11-05T05:09:00Z" }]
      }]
    };
    const html = renderToStaticMarkup(h(UserFootprint, { userId: 1, provider: false }));
    expect(html).toContain("ثبت‌نام کرد");
    expect(html).toContain("tab:new");
    expect(html).toContain("برنامهٔ اندروید");
    expect(html).toContain("اینستاگرام");
    expect(html).toContain("۱ ساعت و ۱۰ دقیقه");
    expect(html).toContain("۰۸:۳۸"); // Tehran time
    expect(html).not.toContain("صفحهٔ عمومیش");
  });

  it("marks the step that loses the most people", () => {
    adminData = {
      summary: { visits: 12, people: 5, accounts: 3, avg_seconds: 300 },
      sources: [{ source: "direct", count: 12 }],
      lastScreens: [{ name: "tab:settings", count: 4 }],
      funnels: [{ type: "artist", signed: 10, services: 8, posts: 7, shared: 2, booked: 1 }]
    };
    const html = renderToStaticMarkup(h(ActivityReport, { days: 30 }));
    expect(html).toMatch(/is-drop[^>]*><span>لینکشون رو فرستادن/);
    expect(html).toContain("توی این بازه کسی ثبت‌نام نکرده.");
    expect(html).toContain("تنظیمات");
  });

  it("reads names and times the way the owner would say them", () => {
    expect(activityLabel("action", "tutorial_skip:3")).toBe("آموزش رو توی اسلاید ۳ بست");
    expect(durationLabel(20)).toBe("کمتر از یه دقیقه");
    expect(sourceLabel("")).toBe("مستقیم");
  });
});
