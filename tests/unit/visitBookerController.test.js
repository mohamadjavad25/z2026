import { describe, it, expect, vi } from "vitest";
import { createVisitBookerController } from "../../app/features/booking/visitBookerController.js";
import { normalizeServices } from "../../app/features/booking/visitBookerModel.js";

const services = normalizeServices([
  { id: 1, name: "مانیکور", duration: "۴۵ دقیقه", price: "450" },
  { id: 2, name: "کوتاهی", duration: "۳۰ دقیقه", price: "300" },
  { id: 3, name: "ابرو", duration: "۲۰ دقیقه", price: "250" }
]);
const days = [{ value: "d1", label: "امروز" }, { value: "d2", label: "فردا" }, { value: "d3", label: "پس‌فردا" }, { value: "d4", label: "جمعه", closed: true }];

const flush = async () => { for (let i = 0; i < 8; i += 1) await new Promise((resolve) => setTimeout(resolve, 0)); };
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
const okPlan = (parts = []) => ({ ok: true, data: { ok: true, parts } });

/** A source answering from a table: times per day, a plan that is fine unless told otherwise. */
function fakeSource({ timesByDay = { d1: ["۱۰:۰۰", "۱۰:۳۰"], d2: ["۱۱:۰۰"], d3: ["۱۲:۰۰"] }, plan, withPlan = true } = {}) {
  const calls = { times: [], plan: [] };
  const source = {
    calls,
    loadTimes: vi.fn(async (query) => { calls.times.push(query); return { ok: true, times: timesByDay[query.day] || [] }; })
  };
  if (withPlan) {
    source.loadPlan = vi.fn(async (query) => { calls.plan.push(query); return plan ? plan(query) : okPlan(query.services.map((s) => ({ service: s.name, staff: "ا" }))); });
  }
  return source;
}
const make = (over = {}) => {
  const source = over.source || fakeSource();
  const submit = over.submit || vi.fn(async () => ({ ok: true, status: 201, payload: {} }));
  const { source: _source, submit: _submit, ...options } = over;
  const controller = createVisitBookerController({ role: "salon", services, days, source, submit, initial: { selected: ["1", "2"], name: "مریم" }, ...options });
  return { controller, source, submit, state: () => controller.getState() };
};

describe("starting", () => {
  it("asks for the first open day's times, takes the first and asks for the plan", async () => {
    const { controller, source, state } = make();
    expect(state().times.status).toBe("idle");
    controller.start();
    expect(state().times.status).toBe("loading");
    await flush();
    expect(source.calls.times).toEqual([{ day: "d1", fresh: false, services: [{ name: "مانیکور", minutes: 45 }, { name: "کوتاهی", minutes: 30 }] }]);
    expect(state().times).toMatchObject({ status: "ready", list: ["۱۰:۰۰", "۱۰:۳۰"] });
    expect(state().time).toBe("۱۰:۰۰");
    expect(source.calls.plan).toHaveLength(1);
    expect(source.calls.plan[0]).toMatchObject({ day: "d1", time: "۱۰:۰۰" });
    expect(state().plan.status).toBe("ok");
    expect(state().readiness.ok).toBe(true);
  });

  it("starts on a closed first day by using the first open one", async () => {
    const { source, controller } = make({ source: fakeSource() });
    const closedFirst = createVisitBookerController({ role: "salon", services, days: [{ value: "x", closed: true }, ...days], source, submit: vi.fn(), initial: { selected: ["1"] } });
    closedFirst.start();
    await flush();
    expect(closedFirst.getState().day).toBe("d1");
    controller.dispose();
  });

  it("ignores a starting selection that holds keys that are not services", async () => {
    const { source } = make();
    const c = createVisitBookerController({ role: "client", services, days, source, submit: vi.fn(), initial: { selected: ["zzz", "3", "3"] } });
    expect(c.getState().selected).toEqual(["3"]);
  });

  it("asks nothing with no service picked", async () => {
    const { controller, source, state } = make({ initial: { selected: [] } });
    controller.start();
    await flush();
    expect(source.loadTimes).not.toHaveBeenCalled();
    expect(state().times.status).toBe("idle");
    expect(state().readiness).toMatchObject({ ok: false, reason: "missing" });
    expect(state().readiness.missing).toContain("خدمت");
  });
});

describe("answers that arrive late", () => {
  it("only the latest picks count when an older answer comes in last", async () => {
    const slow = deferred();
    let call = 0;
    const source = fakeSource();
    source.loadTimes = vi.fn(async () => {
      call += 1;
      if (call === 1) { await slow.promise; return { ok: true, times: ["۰۹:۰۰"] }; }
      return { ok: true, times: ["۱۵:۰۰"] };
    });
    const { controller, state } = make({ source });
    controller.start();
    await flush();
    controller.toggleService("3"); // picks change while the first answer is still out
    await flush();
    expect(state().times.list).toEqual(["۱۵:۰۰"]);
    slow.resolve();
    await flush();
    expect(state().times.list).toEqual(["۱۵:۰۰"]);
    expect(state().time).toBe("۱۵:۰۰");
  });

  it("an old plan never overwrites the plan for the time chosen since", async () => {
    const slow = deferred();
    let call = 0;
    const source = fakeSource();
    source.loadPlan = vi.fn(async () => {
      call += 1;
      if (call === 1) { await slow.promise; return { ok: true, data: { ok: false, code: "STAFF_BUSY", message: "قدیمی", parts: [] } }; }
      return okPlan([{ service: "مانیکور", staff: "جدید" }]);
    });
    const { controller, state } = make({ source });
    controller.start();
    await flush();
    controller.setTime("۱۰:۳۰");
    await flush();
    expect(state().plan).toMatchObject({ status: "ok", parts: [{ service: "مانیکور", staff: "جدید" }] });
    slow.resolve();
    await flush();
    expect(state().plan.status).toBe("ok");
    expect(state().plan.message).toBe("");
  });

  it("answers that come after dispose change nothing and do not throw", async () => {
    const slow = deferred();
    const source = fakeSource();
    source.loadTimes = vi.fn(async () => { await slow.promise; return { ok: true, times: ["۱۰:۰۰"] }; });
    const { controller } = make({ source });
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.start();
    await flush();
    const calls = listener.mock.calls.length;
    controller.dispose();
    slow.resolve();
    await flush();
    expect(listener.mock.calls.length).toBe(calls);
  });
});

describe("the nearest open day", () => {
  it("skips a day with nothing free, remembers it did, and stops at the first that has times", async () => {
    const source = fakeSource({ timesByDay: { d1: [], d2: ["۱۱:۰۰"], d3: ["۱۲:۰۰"] } });
    const { controller, state } = make({ source });
    controller.start();
    await flush();
    expect(state().day).toBe("d2");
    expect(state().times).toMatchObject({ status: "ready", list: ["۱۱:۰۰"], note: "advanced" });
    expect(source.calls.times.map((q) => q.day)).toEqual(["d1", "d2"]);
  });

  it("never offers a closed day and leaves the first day when nothing is free anywhere", async () => {
    const source = fakeSource({ timesByDay: {} });
    const { controller, state } = make({ source });
    controller.start();
    await flush();
    expect(source.calls.times.map((q) => q.day)).toEqual(["d1", "d2", "d3"]);
    expect(state().day).toBe("d1");
    expect(state().times).toMatchObject({ status: "ready", list: [], note: "" });
    expect(state().time).toBe("");
    expect(state().readiness.missing).toContain("ساعت");
  });

  it("does not hop away from a day the person chose", async () => {
    const source = fakeSource({ timesByDay: { d1: ["۱۰:۰۰"], d2: [], d3: ["۱۲:۰۰"] } });
    const { controller, state } = make({ source });
    controller.start();
    await flush();
    controller.setDay("d2");
    await flush();
    expect(state().day).toBe("d2");
    expect(state().times.list).toEqual([]);
    expect(state().time).toBe("");
  });

  it("refuses a closed or unknown day", async () => {
    const { controller, state } = make();
    controller.start();
    await flush();
    controller.setDay("d4");
    controller.setDay("nope");
    expect(state().day).toBe("d1");
  });

  it("can be turned off", async () => {
    const source = fakeSource({ timesByDay: { d1: [], d2: ["۱۱:۰۰"] } });
    const { controller, state } = make({ source, autoAdvance: false });
    controller.start();
    await flush();
    expect(state().day).toBe("d1");
    expect(source.calls.times).toHaveLength(1);
  });
});

describe("when the server cannot answer", () => {
  it("shows the failure for the times, and recovers on retry", async () => {
    const source = fakeSource();
    source.loadTimes = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ ok: true, times: ["۱۰:۰۰"] });
    const { controller, state } = make({ source });
    controller.start();
    await flush();
    expect(state().times.status).toBe("error");
    expect(state().readiness.ok).toBe(false);
    controller.retryTimes();
    await flush();
    expect(state().times.status).toBe("ready");
    expect(state().time).toBe("۱۰:۰۰");
  });

  it("treats a non-ok or malformed answer as a failure, not as an empty day", async () => {
    for (const answer of [{ ok: false }, { ok: true }, { ok: true, times: "x" }, null, undefined]) {
      const source = fakeSource();
      source.loadTimes = vi.fn(async () => answer);
      const { controller, state } = make({ source });
      controller.start();
      await flush();
      expect(state().times.status, JSON.stringify(answer)).toBe("error");
    }
  });

  it("blocks sending while the plan could not be checked, and recovers on retry", async () => {
    const source = fakeSource();
    source.loadPlan = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(okPlan([{ service: "مانیکور", staff: "ا" }]));
    const { controller, state, submit } = make({ source });
    controller.start();
    await flush();
    expect(state().plan.status).toBe("error");
    expect((await controller.submit())).toMatchObject({ ok: false, reason: "error" });
    expect(submit).not.toHaveBeenCalled();
    controller.retryPlan();
    await flush();
    expect(state().plan.status).toBe("ok");
    expect((await controller.submit()).ok).toBe(true);
  });

  it("treats a malformed plan answer as an error", async () => {
    for (const answer of [{ ok: true, data: {} }, { ok: true, data: { ok: "yes", parts: [] } }, { ok: true, data: { ok: true } }, { ok: false }]) {
      const source = fakeSource({ plan: () => answer });
      const { controller, state } = make({ source });
      controller.start();
      await flush();
      expect(state().plan.status, JSON.stringify(answer)).toBe("error");
    }
  });
});

describe("a plan the server refuses", () => {
  it("shows why, blocks sending, and asks for fresh times once when the slot itself is gone", async () => {
    let call = 0;
    const source = fakeSource({
      plan: () => {
        call += 1;
        return call === 1
          ? { ok: true, data: { ok: false, code: "NO_FREE_ARTIST", message: "آرتیست آزاد نیست", partIndex: 1, parts: [] } }
          : okPlan([{ service: "مانیکور", staff: "ا" }]);
      }
    });
    source.loadTimes = vi.fn()
      .mockResolvedValueOnce({ ok: true, times: ["۱۰:۰۰", "۱۰:۳۰"] })
      .mockResolvedValue({ ok: true, times: ["۱۰:۳۰"] });
    const { controller, state, submit } = make({ source });
    controller.start();
    await flush();
    // The problem for 10:00 made the form ask again; 10:00 is gone and 10:30 is chosen and fine.
    expect(source.loadTimes).toHaveBeenCalledTimes(2);
    expect(state().times.list).toEqual(["۱۰:۳۰"]);
    expect(state().time).toBe("۱۰:۳۰");
    expect(state().plan.status).toBe("ok");
    expect((await controller.submit()).ok).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("does not loop when the server keeps refusing the same time", async () => {
    const source = fakeSource({ plan: () => ({ ok: true, data: { ok: false, code: "CONFLICT", message: "پر است", partIndex: -1, parts: [] } }) });
    const { controller, state } = make({ source });
    controller.start();
    await flush();
    expect(source.loadTimes.mock.calls.length).toBeLessThanOrEqual(3);
    expect(state().plan).toMatchObject({ status: "problem", message: "پر است", code: "CONFLICT" });
    expect(state().readiness).toMatchObject({ ok: false, reason: "problem", message: "پر است" });
  });

  it("does not ask for fresh times when only the salon's own artist pick was refused", async () => {
    let call = 0;
    const source = fakeSource({
      plan: () => (++call === 1 ? okPlan([{ service: "مانیکور", staff: "ا" }]) : { ok: true, data: { ok: false, code: "STAFF_BUSY", message: "مشغول است", partIndex: 0, parts: [] } })
    });
    const { controller, state } = make({ source });
    controller.start();
    await flush();
    controller.setStaff(0, "ب");
    await flush();
    expect(source.loadTimes).toHaveBeenCalledTimes(1);
    expect(state().plan).toMatchObject({ status: "problem", code: "STAFF_BUSY", partIndex: 0 });
  });
});

describe("changing the picks", () => {
  it("a different set of services asks again and drops the artists named before", async () => {
    const { controller, source, state } = make();
    controller.start();
    await flush();
    controller.setStaff(0, "ب");
    await flush();
    expect(source.calls.plan.at(-1).staff).toEqual(["ب", ""]);
    controller.toggleService("3");
    await flush();
    expect(state().selected).toEqual(["1", "2", "3"]);
    expect(state().staff).toEqual({});
    expect(source.calls.times.at(-1).services.map((s) => s.name)).toEqual(["مانیکور", "کوتاهی", "ابرو"]);
  });

  it("a different time asks for the plan again and forgets the artists named for the old time", async () => {
    const { controller, source, state } = make();
    controller.start();
    await flush();
    controller.setStaff(1, "ب");
    await flush();
    controller.setTime("۱۰:۳۰");
    await flush();
    expect(state().staff).toEqual({});
    expect(source.calls.plan.at(-1)).toMatchObject({ time: "۱۰:۳۰", staff: ["", ""] });
  });

  it("ignores a time the server did not offer and the one already chosen", async () => {
    const { controller, source } = make();
    controller.start();
    await flush();
    const planCalls = source.calls.plan.length;
    controller.setTime("۱۳:۰۰");
    controller.setTime("10:00");
    await flush();
    expect(source.calls.plan.length).toBe(planCalls);
  });

  it("only the salon can name an artist, and the plan asks with the names only then", async () => {
    for (const role of ["client", "artist"]) {
      const { controller, state } = make({ role });
      controller.start();
      await flush();
      controller.setStaff(0, "ب");
      expect(state().staff, role).toEqual({});
    }
    const { controller, source } = make({ role: "client" });
    controller.start();
    await flush();
    expect(source.calls.plan[0].staff).toEqual([]);
  });

  it("removing every service goes back to nothing chosen and stops asking", async () => {
    const { controller, source, state } = make();
    controller.start();
    await flush();
    controller.toggleService("1");
    controller.toggleService("2");
    await flush();
    expect(state().selected).toEqual([]);
    expect(state().times).toMatchObject({ status: "idle", list: [] });
    expect(state().time).toBe("");
    expect(state().plan.status).toBe("idle");
    const askedTimes = source.calls.times.length;
    const askedPlans = source.calls.plan.length;
    await flush();
    expect(source.calls.times.length).toBe(askedTimes);
    expect(source.calls.plan.length).toBe(askedPlans);
  });

  it("says so when the visit is full and keeps the picks", async () => {
    const many = normalizeServices(Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `خدمت ${i + 1}`, duration: "۳۰ دقیقه" })));
    const source = fakeSource();
    const c = createVisitBookerController({ role: "salon", services: many, days, source, submit: vi.fn(), initial: { selected: many.slice(0, 8).map((s) => s.key) } });
    c.toggleService(many[9].key);
    expect(c.getState().limitHit).toBe(true);
    expect(c.getState().selected).toHaveLength(8);
    c.toggleService(many[0].key);
    expect(c.getState().limitHit).toBe(false);
    expect(c.getState().selected).toHaveLength(7);
  });
});

describe("the independent artist (no plan from the server)", () => {
  it("shows the services one after another from the chosen time", async () => {
    const source = fakeSource({ withPlan: false });
    const { controller, state } = make({ role: "artist", source });
    controller.start();
    await flush();
    expect(state().plan.status).toBe("ok");
    expect(state().plan.parts.map((p) => [p.service, p.start, p.end])).toEqual([["مانیکور", "10:00", "10:45"], ["کوتاهی", "10:45", "11:15"]]);
    controller.setTime("۱۰:۳۰");
    expect(state().plan.parts[0].start).toBe("10:30");
    expect(state().readiness.ok).toBe(true);
  });
});

describe("sending", () => {
  it("says what is missing instead of sending", async () => {
    const { controller, submit, state } = make({ initial: { selected: ["1"], name: "" } });
    controller.start();
    await flush();
    const result = await controller.submit();
    expect(result).toMatchObject({ ok: false, reason: "missing", missing: ["نام مشتری"] });
    expect(submit).not.toHaveBeenCalled();
    expect(state().tried).toBe(true);
  });

  it("sends once however many times it is tapped, then is done", async () => {
    const gate = deferred();
    const submit = vi.fn(async () => { await gate.promise; return { ok: true, status: 201, payload: { data: {} } }; });
    const { controller, state } = make({ submit });
    controller.start();
    await flush();
    const first = controller.submit();
    const second = await controller.submit();
    const third = await controller.submit();
    expect(second).toEqual({ ok: false, reason: "busy" });
    expect(third).toEqual({ ok: false, reason: "busy" });
    expect(state().submitting).toBe(true);
    gate.resolve();
    expect((await first).ok).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(state()).toMatchObject({ submitting: false, done: true });
    // Nothing more can be sent or changed once it is in.
    expect(await controller.submit()).toEqual({ ok: false, reason: "busy" });
    controller.toggleService("3");
    controller.setDay("d2");
    expect(state().selected).toEqual(["1", "2"]);
    expect(state().day).toBe("d1");
  });

  it("builds the body from the picks, the artists named and the person", async () => {
    const { controller, submit } = make();
    controller.start();
    await flush();
    controller.setStaff(1, "ب");
    await flush();
    controller.setPhone("0912");
    await controller.submit();
    // the artist the salon named for the second, and the one shown for the first (the fake source puts "ا" on every row)
    expect(submit).toHaveBeenCalledWith({
      time: "۱۰:۰۰", client: "مریم", phone: "0912", service: "مانیکور + کوتاهی", durationMinutes: 75, bookingDate: "d1",
      parts: [{ service: "مانیکور", duration: "۴۵ دقیقه", staff: "ا" }, { service: "کوتاهی", duration: "۳۰ دقیقه", staff: "ب" }]
    });
  });

  it("a refused booking shows the server's words, can be tried again, and asks for fresh times when the slot was taken", async () => {
    const submit = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 409, payload: { error: "این زمان قبلاً رزرو شده است." } })
      .mockResolvedValueOnce({ ok: true, status: 201, payload: {} });
    const source = fakeSource();
    const { controller, state } = make({ submit, source });
    controller.start();
    await flush();
    const timesAsked = source.calls.times.length;
    const result = await controller.submit();
    await flush();
    expect(result).toMatchObject({ ok: false, reason: "refused", message: "این زمان قبلاً رزرو شده است." });
    expect(state()).toMatchObject({ error: "این زمان قبلاً رزرو شده است.", submitting: false, done: false });
    expect(source.calls.times.length).toBe(timesAsked + 1);
    expect(state().time).toBe("۱۰:۰۰");
    expect((await controller.submit()).ok).toBe(true);
    expect(state().error).toBe("");
  });

  it("turns a network failure into a message and leaves the form usable", async () => {
    const submit = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ok: true, status: 201, payload: {} });
    const { controller, state } = make({ submit });
    controller.start();
    await flush();
    const result = await controller.submit();
    expect(result.ok).toBe(false);
    expect(state().error).toContain("اتصال");
    expect(state().submitting).toBe(false);
    expect((await controller.submit()).ok).toBe(true);
  });

  it("cannot be changed while a booking is on its way", async () => {
    const gate = deferred();
    const submit = vi.fn(async () => { await gate.promise; return { ok: false, status: 500, payload: {} }; });
    const { controller, state } = make({ submit });
    controller.start();
    await flush();
    const pending = controller.submit();
    controller.toggleService("3");
    controller.setDay("d2");
    controller.setTime("۱۰:۳۰");
    controller.setStaff(0, "ب");
    expect(state().selected).toEqual(["1", "2"]);
    expect(state().day).toBe("d1");
    expect(state().time).toBe("۱۰:۰۰");
    expect(state().staff).toEqual({});
    gate.resolve();
    await pending;
  });
});

describe("asking for the times again", () => {
  const freshFlags = (source) => source.loadTimes.mock.calls.map(([query]) => Boolean(query.fresh));
  it("asks plainly for a new day or new services, and 'fresh' after a refused booking, a failed load or a refused plan", async () => {
    const submit = vi.fn().mockResolvedValue({ ok: false, status: 409, payload: {} });
    const source = fakeSource();
    const { controller } = make({ source, submit });
    controller.start();
    await flush();
    controller.setDay("d2");
    await flush();
    controller.toggleService("3");
    await flush();
    expect(freshFlags(source)).toEqual([false, false, false]);
    await controller.submit();
    await flush();
    expect(freshFlags(source).at(-1)).toBe(true);
    controller.retryTimes();
    await flush();
    expect(freshFlags(source).at(-1)).toBe(true);
  });

  it("asks fresh when the plan for a time is refused because the slot is gone", async () => {
    let first = true;
    const source = fakeSource({ plan: () => { if (first) { first = false; return { ok: true, data: { ok: false, code: "CONFLICT", message: "پر", partIndex: -1, parts: [] } }; } return okPlan([{ service: "مانیکور", staff: "ا" }]); } });
    const { controller } = make({ source });
    controller.start();
    await flush();
    expect(freshFlags(source)).toEqual([false, true]);
  });
});

describe("subscribing", () => {
  it("gives a new state on every change and the same object in between", async () => {
    const { controller } = make();
    const seen = [];
    const off = controller.subscribe(() => seen.push(controller.getState()));
    controller.start();
    await flush();
    const settled = controller.getState();
    expect(controller.getState()).toBe(settled);
    expect(new Set(seen).size).toBe(seen.length);
    off();
    controller.setName("نام دیگر");
    expect(seen.at(-1)).not.toBe(controller.getState());
  });
});
