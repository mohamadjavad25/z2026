import { describe, it, expect } from "vitest";
import {
  MAX_VISIT_SERVICES, buildSubmitBody, clockText, createState, endTimeLabel, missingText, normalizeServices, pickedServices,
  readiness, sameTime, sanitizeSelection, sequentialPlan, submitFailure, toggleSelection, visitQuery, visitSummaryText,
  visitTotals, withDay, withSelection, withStaff, withTime
} from "../../app/features/booking/visitBookerModel.js";

const raw = [
  { id: 1, name: "مانیکور", duration: "۴۵ دقیقه", price: "450", emoji: "nails" },
  { id: 2, name: "کوتاهی", duration: "30 دقیقه", price: "۳۰۰" },
  { id: 3, name: "ابرو", duration: "۲۰ دقیقه", price: "قیمت توافقی" },
  { id: 4, name: "ماساژ", duration: "", price: "" }
];
const services = normalizeServices(raw);
const bySlug = (...names) => names.map((name) => services.find((service) => service.name === name));

describe("normalizeServices", () => {
  it("reads lengths the way the server does, prices as numbers, and keeps the emoji", () => {
    expect(services.map((s) => [s.key, s.name, s.minutes, s.price, s.emoji])).toEqual([
      ["1", "مانیکور", 45, 450, "nails"],
      ["2", "کوتاهی", 30, 300, ""],
      ["3", "ابرو", 20, 0, ""],
      ["4", "ماساژ", 60, 0, ""]
    ]);
  });

  it("drops nameless entries, repeats and anything that is not a list", () => {
    expect(normalizeServices(null)).toEqual([]);
    expect(normalizeServices(undefined)).toEqual([]);
    expect(normalizeServices([null, {}, { name: "  " }, { id: 9 }])).toEqual([]);
    const list = normalizeServices([{ id: 1, name: "الف" }, { id: 1, name: "ب" }, { id: 2, name: "الف" }, { id: 3, name: "ب" }]);
    expect(list.map((s) => s.key)).toEqual(["1", "3"]);
  });

  it("falls back to the name as the key when a service has no id", () => {
    expect(normalizeServices([{ name: "فقط نام", duration: "۳۰ دقیقه" }])[0].key).toBe("فقط نام");
  });
});

describe("selection", () => {
  it("keeps the order picked and toggles off", () => {
    let keys = [];
    for (const key of ["2", "1", "3"]) keys = toggleSelection(keys, key, services).keys;
    expect(keys).toEqual(["2", "1", "3"]);
    expect(toggleSelection(keys, "1", services)).toEqual({ keys: ["2", "3"], limited: false });
    expect(pickedServices(keys, services).map((s) => s.name)).toEqual(["کوتاهی", "مانیکور", "ابرو"]);
  });

  it("ignores a key that is not a service and refuses a ninth", () => {
    expect(toggleSelection(["1"], "nope", services)).toEqual({ keys: ["1"], limited: false });
    const many = normalizeServices(Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `خدمت ${i + 1}`, duration: "۳۰ دقیقه" })));
    let keys = [];
    for (const service of many) keys = toggleSelection(keys, service.key, many).keys;
    expect(keys).toHaveLength(MAX_VISIT_SERVICES);
    expect(toggleSelection(keys, many[9].key, many)).toEqual({ keys, limited: true });
    // Taking one off always works, even when full.
    expect(toggleSelection(keys, keys[0], many).keys).toHaveLength(MAX_VISIT_SERVICES - 1);
  });

  it("sanitizes a starting selection from outside", () => {
    expect(sanitizeSelection(["2", "2", "zzz", "1"], services)).toEqual(["2", "1"]);
    expect(sanitizeSelection(null, services)).toEqual([]);
    expect(sanitizeSelection(services.map((s) => s.key), services)).toHaveLength(4);
  });
});

describe("totals and the summary line", () => {
  it("adds minutes and prices", () => {
    expect(visitTotals(bySlug("مانیکور", "کوتاهی"))).toEqual({ count: 2, minutes: 75, price: 750 });
  });

  it("has no total price when any service has none", () => {
    expect(visitTotals(bySlug("مانیکور", "ابرو"))).toEqual({ count: 2, minutes: 65, price: 0 });
    expect(visitTotals([])).toEqual({ count: 0, minutes: 0, price: 0 });
  });

  it("writes the summary in Persian digits and leaves the price out when unknown", () => {
    expect(visitSummaryText(bySlug("مانیکور", "کوتاهی"))).toBe("۲ خدمت، ۷۵ دقیقه، ۷۵۰ تومان");
    expect(visitSummaryText(bySlug("مانیکور", "ابرو"))).toBe("۲ خدمت، ۶۵ دقیقه");
    expect(visitSummaryText([])).toBe("");
  });
});

describe("what a change clears", () => {
  const base = { ...createState({ selected: ["1"], day: "d1", name: "مریم", phone: "0912" }), time: "۱۰:۰۰", staff: { 0: "A" } };
  it("a different set of services clears the time and the artists", () => {
    expect(withSelection(base, ["1", "2"])).toMatchObject({ selected: ["1", "2"], time: "", staff: {}, name: "مریم", day: "d1" });
  });
  it("a different day clears the time and the artists, the same day does not", () => {
    expect(withDay(base, "d2")).toMatchObject({ day: "d2", time: "", staff: {} });
    expect(withDay(base, "d1")).toBe(base);
  });
  it("a different time clears the artists named for the old one", () => {
    expect(withTime(base, "۱۱:۰۰")).toMatchObject({ time: "۱۱:۰۰", staff: {} });
  });
  it("naming and un-naming an artist touches only that service", () => {
    const named = withStaff(withStaff(base, 1, "B"), 0, "C");
    expect(named.staff).toEqual({ 0: "C", 1: "B" });
    expect(withStaff(named, 0, "").staff).toEqual({ 1: "B" });
    expect(base.staff).toEqual({ 0: "A" });
  });
});

describe("clock helpers", () => {
  it("compares times across digit scripts", () => {
    expect(sameTime("۱۰:۰۰", "10:00")).toBe(true);
    expect(sameTime("10:00", "10:30")).toBe(false);
    expect(sameTime("", "10:00")).toBe(false);
    expect(sameTime(undefined, undefined)).toBe(false);
  });
  it("adds minutes to a start, in Persian digits, across the hour", () => {
    expect(endTimeLabel("10:45", 30)).toBe("۱۱:۱۵");
    expect(endTimeLabel("۱۸:۳۰", 90)).toBe("۲۰:۰۰");
    expect(clockText("09:05")).toBe("۰۹:۰۵");
  });
});

describe("sequentialPlan", () => {
  it("puts the services one after another from the start", () => {
    expect(sequentialPlan("10:00", bySlug("مانیکور", "کوتاهی", "ابرو"))).toEqual([
      { service: "مانیکور", minutes: 45, start: "10:00", end: "10:45", staff: "" },
      { service: "کوتاهی", minutes: 30, start: "10:45", end: "11:15", staff: "" },
      { service: "ابرو", minutes: 20, start: "11:15", end: "11:35", staff: "" }
    ]);
  });
  it("is empty without a time or services", () => {
    expect(sequentialPlan("", bySlug("مانیکور"))).toEqual([]);
    expect(sequentialPlan("10:00", [])).toEqual([]);
  });
});

describe("readiness", () => {
  const ready = { ...createState({ selected: ["1"], day: "d", name: "مریم", phone: "0912" }), time: "10:00" };
  const list = bySlug("مانیکور");
  it("is ready with everything and a good plan", () => {
    expect(readiness("salon", ready, list, { status: "ok" })).toEqual({ ok: true, missing: [], reason: "" });
    expect(readiness("artist", ready, list, { status: "ok" }).ok).toBe(true);
    expect(readiness("client", ready, list, { status: "ok" }).ok).toBe(true);
  });
  it("names what is missing, in reading order", () => {
    expect(readiness("salon", createState(), []).missing).toEqual(["خدمت", "نام مشتری", "ساعت"]);
    expect(readiness("salon", { ...ready, name: "  " }, list).missing).toEqual(["نام مشتری"]);
    expect(readiness("salon", { ...ready, time: "" }, list).missing).toEqual(["ساعت"]);
    expect(missingText(["خدمت", "ساعت"])).toBe("برای ثبت لازم است: خدمت، ساعت");
    expect(missingText([])).toBe("");
  });
  it("asks a client for a phone, not a name (the name is their account's)", () => {
    expect(readiness("client", { ...ready, name: "", phone: "" }, list).missing).toEqual(["شماره تماس"]);
    expect(readiness("client", { ...ready, name: "" }, list).ok).toBe(true);
  });
  it("is not ready while the server is still checking, or when it refused the plan or could not answer", () => {
    expect(readiness("salon", ready, list, { status: "loading" })).toMatchObject({ ok: false, reason: "checking" });
    expect(readiness("salon", ready, list, { status: "idle" })).toMatchObject({ ok: false, reason: "checking" });
    expect(readiness("salon", ready, list, { status: "problem", message: "پر است" })).toMatchObject({ ok: false, reason: "problem", message: "پر است" });
    expect(readiness("salon", ready, list, { status: "error" })).toMatchObject({ ok: false, reason: "error" });
  });
});

describe("buildSubmitBody", () => {
  const state = { ...createState({ selected: ["1", "2"], day: "1405-07-28", name: " مریم ", phone: " 0912 " }), time: "۱۰:۰۰" };
  it("sends several services as parts, in order, for a client, without any artist", () => {
    const body = buildSubmitBody("client", { ...state, staff: { 0: "X" } }, bySlug("مانیکور", "کوتاهی"));
    expect(body).toEqual({
      time: "۱۰:۰۰", client: "مریم", phone: "0912", service: "مانیکور + کوتاهی", durationMinutes: 75, bookingDate: "1405-07-28",
      parts: [{ service: "مانیکور", duration: "۴۵ دقیقه" }, { service: "کوتاهی", duration: "30 دقیقه" }],
      waitMinutes: 60
    });
  });
  it("a client waits one hour by default (decision 2026-10-21); the open choice waits until the appointment, at most 24 hours; with the hour it may name a backup salon", () => {
    const list = bySlug("مانیکور");
    expect(buildSubmitBody("client", state, list)).toMatchObject({ waitMinutes: 60 });
    expect(buildSubmitBody("client", { ...state, wait: "open" }, list)).toMatchObject({ waitMinutes: null });
    expect(buildSubmitBody("client", { ...state, wait: "open", backup: "7" }, list).fallbackSalonUserId).toBeUndefined();
    expect(buildSubmitBody("client", { ...state, wait: "hour" }, list)).toMatchObject({ waitMinutes: 60 });
    expect(buildSubmitBody("client", { ...state, wait: "hour", backup: "7" }, list)).toMatchObject({ waitMinutes: 60, fallbackSalonUserId: "7" });
    expect(buildSubmitBody("salon", { ...state, wait: "hour", backup: "7" }, list).waitMinutes).toBeUndefined();
  });
  it("carries the salon's artist per service", () => {
    const body = buildSubmitBody("salon", { ...state, staff: { 1: "آرتیست" } }, bySlug("مانیکور", "کوتاهی"));
    expect(body.parts).toEqual([
      { service: "مانیکور", duration: "۴۵ دقیقه" },
      { service: "کوتاهی", duration: "30 دقیقه", staff: "آرتیست" }
    ]);
  });
  it("the salon sends the artist it was shown for every service, so a single service is not saved unassigned", () => {
    const shown = [{ staff: "مهسا" }, { staff: "حدیث" }];
    const several = buildSubmitBody("salon", { ...state, staff: { 1: "نمکی" } }, bySlug("مانیکور", "کوتاهی"), shown);
    expect(several.parts.map((p) => p.staff)).toEqual(["مهسا", "نمکی"]);
    const single = buildSubmitBody("salon", { ...state, staff: {} }, bySlug("مانیکور"), shown);
    expect(single.staff).toBe("مهسا");
    expect(single.parts).toBeUndefined();
    // nothing to send when the system found nobody
    expect(buildSubmitBody("salon", { ...state, staff: {} }, bySlug("مانیکور"), [{ staff: "" }]).staff).toBeUndefined();
    // a client and an artist never send an artist, whatever the plan says
    expect(buildSubmitBody("client", { ...state, staff: {} }, bySlug("مانیکور"), shown).staff).toBeUndefined();
    expect(buildSubmitBody("client", state, bySlug("مانیکور", "کوتاهی"), shown).parts.every((p) => !("staff" in p))).toBe(true);
    expect(buildSubmitBody("artist", state, bySlug("مانیکور"), shown)).not.toHaveProperty("staff");
  });
  it("one service is a plain booking, with the salon's artist when named", () => {
    const one = buildSubmitBody("salon", { ...state, staff: { 0: "آرتیست" } }, bySlug("مانیکور"));
    expect(one).toMatchObject({ service: "مانیکور", durationMinutes: 45, staff: "آرتیست" });
    expect(one.parts).toBeUndefined();
    expect(buildSubmitBody("client", { ...state, staff: { 0: "آرتیست" } }, bySlug("مانیکور")).staff).toBeUndefined();
  });
  it("an artist's own booking is one entry as long as all the services together", () => {
    expect(buildSubmitBody("artist", state, bySlug("مانیکور", "کوتاهی"))).toEqual({
      kind: "booking", time: "۱۰:۰۰", client: "مریم", phone: "0912", service: "مانیکور + کوتاهی", durationMinutes: 75, date: "1405-07-28", status: "تایید"
    });
  });
  it("keeps the joined service text within the stored limit", () => {
    const long = normalizeServices(Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `خدمت با یک اسم نسبتاً طولانی ${i}`.repeat(3), duration: "۳۰ دقیقه" })));
    expect(buildSubmitBody("salon", state, long).service.length).toBeLessThanOrEqual(200);
  });
});

describe("visitQuery", () => {
  it("lists services in order with lengths, and the salon's picks only when asked", () => {
    const state = { ...createState(), staff: { 1: "B" } };
    const list = bySlug("مانیکور", "کوتاهی");
    expect(visitQuery(state, list)).toEqual({ services: [{ name: "مانیکور", minutes: 45 }, { name: "کوتاهی", minutes: 30 }], staff: [] });
    expect(visitQuery(state, list, { withStaff: true }).staff).toEqual(["", "B"]);
  });
});

describe("submitFailure", () => {
  it("asks for fresh times when the time was taken", () => {
    expect(submitFailure({ status: 409, payload: { error: "این زمان قبلاً رزرو شده است." } })).toEqual({ message: "این زمان قبلاً رزرو شده است.", reloadTimes: true });
    expect(submitFailure({ status: 409, payload: {} }).reloadTimes).toBe(true);
  });
  it("has a Persian message for every case, even with no body at all", () => {
    for (const status of [0, 400, 401, 403, 404, 409, 429, 500]) {
      const out = submitFailure({ status });
      expect(out.message, String(status)).toMatch(/[؀-ۿ]/);
    }
    // No status at all means the request never got an answer.
    expect(submitFailure().message).toBe("اتصال برقرار نشد؛ اینترنت را بررسی کن و دوباره امتحان کن.");
    expect(submitFailure({ status: 500 })).toEqual({ message: "ثبت رزرو انجام نشد؛ دوباره امتحان کن.", reloadTimes: false });
    expect(submitFailure({ status: 400, payload: { error: 42 } }).message).toBe("ثبت رزرو انجام نشد؛ دوباره امتحان کن.");
  });
});
