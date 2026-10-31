import { afterEach, describe, expect, it, vi } from "vitest";

const pushed = [];
const state = { pending: new Set(), claimable: true, counts: null };
const counts = () => state.counts || { signups: { client: 2, salon: 1 }, bookings: { "تایید شده": 3, "درخواست": 1, "لغو": 1 }, payments: { count: 0, rial: 0 }, openTickets: 0 };

vi.mock("../../app/lib/admin.js", () => ({ adminPhoneList: () => ["09120000000"] }));
vi.mock("../../app/lib/adminPush.js", () => ({
  pushAdmins: async (message) => { pushed.push(message); return new Set(["09120000000"]); }
}));
vi.mock("../../app/lib/rateLimit.js", () => ({ checkRateLimit: async () => ({ ok: true }) }));
vi.mock("../../app/lib/sms.js", () => ({ sendTemplateSms: async () => ({ ok: true }) }));
vi.mock("../../app/lib/db/repos/adminNews.js", () => ({
  markPending: async (kind) => { state.pending.add(kind); },
  claim: async (kind) => {
    if (!state.claimable || !state.pending.has(kind)) return null;
    state.pending.delete(kind);
    return { kind, last_label: "سالن گلاره" };
  },
  listPending: async () => [...state.pending],
  readState: async () => ({}),
  writeState: async () => {},
  todayCounts: async () => counts()
}));

const { bookingGroups, flushAdminNews, isQuietHour, newsMessage, noteAdminEvent, summaryMessage, tehranClock } = await import("../../app/lib/adminNews.js");
const { judge } = await import("../../app/lib/serverWatch.js");
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
// Tehran is UTC+3:30 all year.
const at = (utc) => new Date(`${utc}Z`);

afterEach(() => { pushed.length = 0; state.pending.clear(); state.claimable = true; state.counts = null; vi.useRealTimers(); });

describe("operator news: running counts", () => {
  it("reads the Tehran day and hour", () => {
    expect(tehranClock(at("2026-10-29T18:30:00"))).toEqual({ hour: 22, day: "2026-10-29" });
    expect(tehranClock(at("2026-10-29T21:00:00"))).toEqual({ hour: 0, day: "2026-10-30" });
  });

  it("keeps 23:00 to 08:00 quiet", () => {
    expect(isQuietHour(at("2026-10-29T19:29:00"))).toBe(false); // 22:59
    expect(isQuietHour(at("2026-10-29T19:30:00"))).toBe(true); // 23:00
    expect(isQuietHour(at("2026-10-30T04:29:00"))).toBe(true); // 07:59
    expect(isQuietHour(at("2026-10-30T04:30:00"))).toBe(false); // 08:00
  });

  it("says the day's count, not one line per person", () => {
    const message = newsMessage("signups", counts(), "سالن گلاره");
    expect(message.title).toBe("ثبت‌نام امروز: ۳ نفر");
    expect(message.body).toBe("۲ مشتری، ۱ سالن · آخری: سالن گلاره");
  });

  it("groups bookings the way the client sees them", () => {
    expect(bookingGroups({ "تایید شده": 3, "درخواست": 1, "لغو": 1, "منقضی شده": 2 })).toEqual({ total: 7, confirmed: 3, waiting: 1, cancelled: 3 });
    expect(newsMessage("bookings", counts()).title).toBe("نوبت‌های امروز: ۵ تا");
  });

  it("rings with a tag so the phone replaces the earlier notification", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: at("2026-10-29T10:00:00") });
    noteAdminEvent("signups", "سالن گلاره");
    await vi.waitFor(() => expect(pushed).toHaveLength(1));
    expect(pushed[0].tag).toBe("signups");
  });

  it("waits through the night and tells in the morning", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: at("2026-10-29T21:00:00") }); // 00:30
    noteAdminEvent("signups", "مشتری سارا");
    await settle();
    expect(pushed).toEqual([]);
    expect(state.pending.has("signups")).toBe(true);
    await flushAdminNews(at("2026-10-30T04:35:00")); // 08:05
    expect(pushed.map((m) => m.tag)).toEqual(["signups"]);
  });

  it("does not ring again inside the 15 minutes", async () => {
    state.claimable = false;
    vi.useFakeTimers({ toFake: ["Date"], now: at("2026-10-29T10:00:00") });
    noteAdminEvent("bookings", "x");
    await settle();
    expect(pushed).toEqual([]);
  });

  it("sends the day's summary once after 22:00", async () => {
    const first = await flushAdminNews(at("2026-10-29T18:35:00"), { busyToday: 0 });
    expect(first.summary).toBe(true);
    expect(pushed[0].title).toBe("خلاصهٔ امروز فرفرو");
    expect(pushed[0].body).toContain("سرور امروز آروم بود");
  });

  it("writes the summary with money and open support messages", () => {
    const body = summaryMessage({ ...counts(), payments: { count: 2, rial: 18_000_000 }, openTickets: 1 }, { busy: 2 }).body;
    expect(body).toContain("پرداخت: ۲");
    expect(body).toContain("پیام پشتیبانی بی‌جواب: ۱");
    expect(body).toContain("سرور امروز ۲ بار شلوغ شد");
  });
});

describe("server watch", () => {
  const calm = { cpu: 0.2, disk: 0.3, memoryFree: 0.5, smsFailures: 0, answerMs: 80 };
  const now = at("2026-10-29T10:00:00");

  it("says nothing when all is calm", () => {
    expect(judge(calm, {}, now).alerts).toEqual([]);
  });

  it("needs two busy checks in a row (10 minutes)", () => {
    const one = judge({ ...calm, cpu: 0.9 }, {}, now);
    expect(one.alerts).toEqual([]);
    const two = judge({ ...calm, cpu: 0.9 }, one.state, now);
    expect(two.alerts.map((a) => a.key)).toEqual(["busy"]);
    expect(two.busyToday).toBe(1);
    // Still busy: no repeat until it calms down and comes back.
    expect(judge({ ...calm, cpu: 0.9 }, two.state, now).alerts).toEqual([]);
  });

  it("calls a site that stopped answering slow", () => {
    const one = judge({ ...calm, answerMs: Infinity }, {}, now);
    const two = judge({ ...calm, answerMs: Infinity }, one.state, now);
    expect(two.alerts[0].key).toBe("slow");
    expect(two.alerts[0].body).toContain("جواب نمی‌ده");
  });

  it("warns about disk, memory and SMS at once", () => {
    const keys = judge({ ...calm, disk: 0.85, memoryFree: 0.05, smsFailures: 4 }, {}, now).alerts.map((a) => a.key);
    expect(keys).toEqual(["disk", "memory", "sms"]);
  });

  it("says it is time for a bigger server after three busy days in a row", () => {
    const busyDays = { "2026-10-27": 1, "2026-10-28": 2 };
    const one = judge({ ...calm, cpu: 0.95 }, { busyDays }, now);
    const two = judge({ ...calm, cpu: 0.95 }, one.state, now);
    expect(two.alerts.map((a) => a.key)).toEqual(["busy", "upgrade"]);
    const gap = judge({ ...calm, cpu: 0.95 }, { busyDays: { "2026-10-26": 1, "2026-10-28": 1 }, cpuStrikes: 1 }, now);
    expect(gap.alerts.map((a) => a.key)).toEqual(["busy"]);
  });
});
