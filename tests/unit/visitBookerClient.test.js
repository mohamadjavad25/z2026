import { describe, it, expect, vi } from "vitest";
import { createVisitBookerController } from "../../app/features/booking/visitBookerController.js";
import { buildSubmitBody, createState, maxServicesFor, normalizeServices, submitFailure, visitQuery, visitSummaryText, withPeople } from "../../app/features/booking/visitBookerModel.js";
import { bookingPeople, expandPartsForPeople, scheduleBookingParts, summarizeBookingParts } from "../../app/shared/lib/bookingParts.js";
import { canRetryExpired, repeatRequestBody, requestedOf } from "../../app/features/client/expiredRequest.js";

const services = normalizeServices([
  { id: 1, name: "کوتاهی", duration: "۳۰ دقیقه", price: "300" },
  { id: 2, name: "ابرو", duration: "۲۰ دقیقه", price: "250" }
]);
const days = [
  { value: "d1", label: "امروز", weekday: "امروز" },
  { value: "d2", label: "شنبه ۳ آبان", weekday: "شنبه" },
  { value: "d3", label: "یکشنبه ۴ آبان", weekday: "یکشنبه", closed: true },
  { value: "d4", label: "دوشنبه ۵ آبان", weekday: "دوشنبه" }
];
const flush = async () => { for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0)); };
const okPlan = () => ({ ok: true, data: { ok: true, parts: [{ service: "کوتاهی", staff: "ا" }] } });

function make({ timesByDay = {}, submit, initial = {} } = {}) {
  const calls = [];
  const source = {
    calls,
    loadTimes: vi.fn(async (query) => { calls.push(query); return { ok: true, times: timesByDay[query.day] ? (typeof timesByDay[query.day] === "function" ? timesByDay[query.day](query) : timesByDay[query.day]) : [] }; }),
    loadPlan: vi.fn(async () => okPlan())
  };
  const send = submit || vi.fn(async () => ({ ok: true, status: 201, payload: {} }));
  const controller = createVisitBookerController({ role: "client", services, days, source, submit: send, initial: { selected: ["1"], phone: "0912", ...initial }, autoAdvance: false });
  return { controller, source, submit: send, state: () => controller.getState() };
}

describe("parts for a group", () => {
  const one = [{ service: "کوتاهی", minutes: 30, staff: "" }, { service: "ابرو", minutes: 20, staff: "" }];
  it("repeats one person's services for each person, side by side from the same start", () => {
    const parts = expandPartsForPeople(one, 2);
    expect(parts.map((part) => [part.service, part.person || 0])).toEqual([["کوتاهی", 0], ["ابرو", 0], ["کوتاهی", 1], ["ابرو", 1]]);
    expect(scheduleBookingParts("10:00", parts).map((part) => [part.startLabel, part.endLabel])).toEqual([["10:00", "10:30"], ["10:30", "10:50"], ["10:00", "10:30"], ["10:30", "10:50"]]);
    expect(bookingPeople(parts)).toBe(2);
    expect(summarizeBookingParts(parts)).toEqual({ service: "کوتاهی + ابرو · ۲ نفر", durationMinutes: 50 });
  });
  it("leaves one person exactly as it was (no person key, no head count)", () => {
    const parts = expandPartsForPeople(one, 1);
    expect(parts).toEqual(one);
    expect(summarizeBookingParts(parts)).toEqual({ service: "کوتاهی + ابرو", durationMinutes: 50 });
    expect(bookingPeople(parts)).toBe(1);
  });
  it("caps services per person so the parts stay within 8", () => {
    expect([maxServicesFor(1), maxServicesFor(2), maxServicesFor(3)]).toEqual([8, 4, 2]);
  });
});

describe("the body and the query of a group", () => {
  const list = services.slice(0, 1);
  it("together: asks for `people` and sends one person's services", () => {
    const state = withPeople({ ...createState({ day: "d1" }), time: "۱۰:۰۰", phone: "0912", name: "م" }, 2);
    state.time = "۱۰:۰۰";
    expect(visitQuery(state, list)).toMatchObject({ services: [{ name: "کوتاهی", minutes: 30 }], people: 2 });
    const body = buildSubmitBody("client", state, list);
    expect(body).toMatchObject({ service: "کوتاهی", people: 2, durationMinutes: 30 });
    expect(body.parts).toBeUndefined();
    expect(body.fallbackSalonUserId).toBeUndefined();
  });
  it("one after another: the services repeated in one ordinary visit, no head count", () => {
    const state = { ...withPeople({ ...createState({ day: "d1" }), phone: "0912", name: "م" }, 2, true), time: "۱۰:۰۰" };
    expect(visitQuery(state, list)).toEqual({ services: [{ name: "کوتاهی", minutes: 30 }, { name: "کوتاهی", minutes: 30 }], staff: [] });
    const body = buildSubmitBody("client", state, list);
    expect(body.people).toBeUndefined();
    expect(body.durationMinutes).toBe(60);
    expect(body.parts.map((part) => part.service)).toEqual(["کوتاهی", "کوتاهی"]);
  });
  it("says how many people and the total in the summary", () => {
    expect(visitSummaryText(list, 2)).toBe("۲ نفر · ۱ خدمت برای هر نفر · ۳۰ دقیقه · ۶۰۰ تومان");
  });
});

describe("«برای چند نفر؟» in the client form", () => {
  it("asks for times with the head count, and keeps only that many services", async () => {
    const { controller, source, state } = make({ timesByDay: { d1: ["۱۰:۰۰"] }, initial: { selected: ["1", "2"] } });
    controller.start();
    await flush();
    controller.setPeople(3);
    await flush();
    expect(state().people).toBe(3);
    expect(state().selected).toEqual(["1", "2"]); // 2 services fit 3 people
    expect(source.calls.at(-1)).toMatchObject({ day: "d1", people: 3 });
    controller.setPeople(1);
    await flush();
    expect(source.calls.at(-1).people).toBeUndefined();
  });

  it("with nobody free together it offers one after another, then asks for the services repeated", async () => {
    const { controller, source, state } = make({ timesByDay: { d1: (query) => (query.people ? [] : ["۱۰:۰۰", "۱۱:۰۰"]) } });
    controller.start();
    await flush();
    controller.setPeople(2);
    await flush();
    expect(state().times).toMatchObject({ status: "ready", list: [] });
    controller.chainPeople();
    await flush();
    expect(state().chain).toBe(true);
    expect(source.calls.at(-1).services).toHaveLength(2);
    expect(source.calls.at(-1).people).toBeUndefined();
    expect(state().times.list).toEqual(["۱۰:۰۰", "۱۱:۰۰"]);
  });
});

describe("a day with no free hour", () => {
  it("finds the first free hour ahead and goes to that day", async () => {
    const { controller, state } = make({ timesByDay: { d1: [], d4: ["۱۰:۳۰", "۱۱:۰۰"] } });
    controller.start();
    await flush();
    expect(state().times.ahead).toEqual({ status: "found", day: "d4", label: "دوشنبه ۵ آبان", time: "۱۰:۳۰" });
    controller.goToAhead();
    await flush();
    expect(state().day).toBe("d4");
    expect(state().time).toBe("۱۰:۳۰");
  });

  it("says nothing is free for two weeks when no later day has an hour", async () => {
    const { controller, state } = make({ timesByDay: {} });
    controller.start();
    await flush();
    expect(state().times.ahead).toEqual({ status: "none" });
  });

  it("a closed day can be tapped; it says when the salon opens next and asks the server nothing", async () => {
    const { controller, source, state } = make({ timesByDay: { d1: ["۱۰:۰۰"] } });
    controller.start();
    await flush();
    const asked = source.calls.length;
    controller.setDay("d3");
    await flush();
    expect(state().day).toBe("d3");
    expect(state().times).toMatchObject({ status: "closed", closedNext: "دوشنبه" });
    expect(source.calls.length).toBe(asked);
    expect(state().time).toBe("");
  });
});

describe("the hour was taken while sending (409)", () => {
  const taken = { ok: false, status: 409, payload: { error: "این زمان قبلاً رزرو شده است." } };
  it("does not jump: offers the next free hour, and «بله، ارسال» sends it", async () => {
    let free = ["۱۰:۰۰", "۱۰:۳۰", "۱۱:۳۰"];
    const submit = vi.fn()
      .mockImplementationOnce(async () => { free = ["۱۰:۳۰", "۱۱:۳۰"]; return taken; })
      .mockResolvedValueOnce({ ok: true, status: 201, payload: {} });
    const { controller, state } = make({ timesByDay: { d1: () => free }, submit });
    controller.start();
    await flush();
    controller.setTime("۱۰:۰۰");
    free = ["۱۰:۳۰", "۱۱:۳۰"];
    await controller.submit();
    expect(state().conflict).toEqual({ taken: "۱۰:۰۰", next: "۱۰:۳۰" });
    expect(state().time).toBe(""); // nothing was chosen for her
    expect(state().error).toBe("");
    const result = await controller.acceptConflict();
    expect(result.ok).toBe(true);
    expect(submit.mock.calls[1][0].time).toBe("۱۰:۳۰");
    expect(state().done).toBe(true);
  });

  it("with no later hour that day it says so and keeps the day list; «ساعت دیگر» just closes the card", async () => {
    let free = ["۱۰:۰۰"];
    const submit = vi.fn().mockResolvedValue(taken);
    const { controller, state } = make({ timesByDay: { d1: () => free }, submit });
    controller.start();
    await flush();
    free = [];
    await controller.submit();
    expect(state().conflict).toEqual({ taken: "۱۰:۰۰", next: "" });
    controller.dismissConflict();
    expect(state().conflict).toBeNull();
    expect(state().day).toBe("d1");
  });

  it("a group refused with GROUP_FULL shows the server's words, no next-hour card", async () => {
    const submit = vi.fn().mockResolvedValue({ ok: false, status: 409, payload: { code: "GROUP_FULL", error: "این ساعت دیگر برای ۲ نفر جا ندارد؛ ساعت‌ها به‌روز شد." } });
    const { controller, state } = make({ timesByDay: { d1: ["۱۰:۰۰"] }, submit });
    controller.start();
    await flush();
    controller.setPeople(2);
    await flush();
    await controller.submit();
    expect(state().conflict).toBeNull();
    expect(state().error).toBe("این ساعت دیگر برای ۲ نفر جا ندارد؛ ساعت‌ها به‌روز شد.");
  });

  it("too many open requests is not about the hour: no reload, no card", () => {
    expect(submitFailure({ status: 409, payload: { code: "TOO_MANY_OPEN_REQUESTS", error: "اول یکی از درخواست‌های قبلی را لغو کن یا منتظر جواب بمان." } }))
      .toEqual({ message: "اول یکی از درخواست‌های قبلی را لغو کن یا منتظر جواب بمان.", reloadTimes: false });
  });
});

describe("an unanswered request", () => {
  const future = "فردا";
  const base = { id: 5, status: "منقضی شده", salon_user_id: 9, booking_date: future, time: "10:00", service: "کوتاهی + ابرو", parts: "", client: "م", phone: "0912" };
  it("can be retried while its appointment is ahead, for salon requests that were not forwarded", () => {
    expect(canRetryExpired(base)).toBe(true);
    expect(canRetryExpired({ ...base, bookingSource: "artist" })).toBe(false);
    expect(canRetryExpired({ ...base, moved_to_booking_id: 3 })).toBe(false);
    expect(canRetryExpired({ ...base, status: "لغو" })).toBe(false);
    expect(canRetryExpired({ ...base, booking_date: "امروز", time: "00:01" })).toBe(false);
  });
  it("is asked again with the same services, day and time (a group keeps its head count)", () => {
    const parts = JSON.stringify([{ service: "کوتاهی", minutes: 30, staff: "ا" }, { service: "ابرو", minutes: 20, staff: "ب" }]);
    expect(repeatRequestBody({ ...base, parts })).toMatchObject({ salonUserId: 9, bookingDate: future, time: "10:00", status: "درخواست", service: "کوتاهی + ابرو" });
    expect(repeatRequestBody({ ...base, parts }).parts).toEqual([{ service: "کوتاهی", duration: "30 دقیقه" }, { service: "ابرو", duration: "20 دقیقه" }]);
    const group = JSON.stringify([{ service: "کوتاهی", minutes: 30, staff: "ا" }, { service: "کوتاهی", minutes: 30, staff: "ب", person: 1 }]);
    expect(requestedOf({ ...base, service: "کوتاهی · ۲ نفر", parts: group })).toEqual({ names: ["کوتاهی"], people: 2 });
    expect(repeatRequestBody({ ...base, service: "کوتاهی · ۲ نفر", parts: group })).toMatchObject({ service: "کوتاهی", people: 2 });
  });
});
