import { afterEach, describe, expect, it, vi } from "vitest";

// Owner, 2026-11-08: Google took a sign-up push for the owner's phone but the phone never showed it. A booking notice
// that only went to the app had no fallback at all. Now its SMS is held ten minutes and sent unless the person opened
// frfro or the booking moved on.
const reached = { value: true };
const sms = vi.fn(async () => ({ ok: true }));
const queue = vi.fn(async () => {});
const due = { rows: [] };
const status = { value: "درخواست" };
const outcomes = [];
const charge = vi.fn(async () => ({ ok: true, charge: { id: 1 } }));

vi.mock("../../app/lib/push.js", () => ({
  pushReachedApp: async () => reached.value,
  reachableByAppPush: async () => reached.value,
  sendPushToUser: async () => ({ ok: true, sent: 1, appSent: 1 })
}));
vi.mock("../../app/lib/sms.js", () => ({ sendTemplateSms: (...args) => sms(...args) }));
vi.mock("../../app/lib/billing/smsCredits.js", () => ({ chargeClientSms: (...args) => charge(...args), refundClientSms: async () => {} }));
vi.mock("../../app/lib/rateLimit.js", () => ({ checkRateLimit: async () => ({ ok: true }) }));
vi.mock("../../app/lib/db/repos/users.js", () => ({ getUserById: async (id) => ({ id, phone: "09120000009", name: "سالن شیدا" }) }));
vi.mock("../../app/lib/db/connection.js", () => ({
  getDb: async () => ({}),
  get: async () => ({ payer: 7 }),
  run: async () => ({ rows: [{ booking_id: 1 }] })
}));
vi.mock("../../app/lib/db/repos/smsBackups.js", () => ({
  bookingStatus: async () => status.value,
  queue: (...args) => queue(...args),
  claimDue: async () => due.rows,
  setOutcome: async (id, outcome) => { outcomes.push([id, outcome]); },
  prune: async () => {}
}));

const { formatPersianDateKey } = await import("../../app/shared/lib/persianCalendar.js");
const bookingSms = await import("../../app/lib/bookingSms.js");
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

afterEach(() => {
  sms.mockClear(); queue.mockClear(); charge.mockClear();
  reached.value = true; status.value = "درخواست"; due.rows = []; outcomes.length = 0;
  vi.restoreAllMocks();
});

describe("holding the booking SMS when the app took the push", () => {
  it("a new request the app took is held for ten minutes, not sent and not dropped", async () => {
    bookingSms.smsNewBookingRequest(5, { client: "مینا", service: "ناخن", bookingDate: "1499-01-01", time: "10:00", booking: { kind: "salon", id: 41 } }, Promise.resolve({ appSent: 1 }));
    await settle();
    expect(sms.mock.calls.filter(([phone]) => phone)).toEqual([]);
    expect(queue).toHaveBeenCalledTimes(1);
    expect(queue.mock.calls[0][0]).toMatchObject({
      userId: 5, template: "booking_request", status: "درخواست", booking: { kind: "salon", id: 41 }, delayMs: 10 * 60 * 1000
    });
  });

  it("without the app the SMS goes at once, as before, and nothing is held", async () => {
    reached.value = false;
    bookingSms.smsNewBookingRequest(5, { client: "مینا", bookingDate: "1499-01-01", time: "10:00", booking: { kind: "salon", id: 41 } }, Promise.resolve({ appSent: 0 }));
    await settle();
    expect(sms).toHaveBeenCalledWith("09120000009", "booking_request", expect.any(Object));
    expect(queue).not.toHaveBeenCalled();
  });

  it("an answer the app took is held with the payer the SMS would have charged", async () => {
    status.value = "تایید شده";
    bookingSms.smsBookingAnswer(9, { providerName: "سالن شیدا", bookingDate: "1499-01-01", time: "10:00", confirmed: true, booking: { kind: "salon", id: 41 } }, Promise.resolve({ appSent: 1 }));
    await settle();
    expect(sms.mock.calls.filter(([phone]) => phone)).toEqual([]);
    expect(queue.mock.calls[0][0]).toMatchObject({ userId: 9, template: "booking_answer", payerUserId: 7, status: "تایید شده" });
  });

  it("a booking that is already gone holds nothing", async () => {
    status.value = null;
    bookingSms.smsNewBookingRequest(5, { bookingDate: "1499-01-01", time: "10:00", booking: { kind: "artist", id: 3 } }, Promise.resolve({ appSent: 1 }));
    await settle();
    expect(queue).not.toHaveBeenCalled();
  });
});

describe("the sweep after ten minutes", () => {
  const row = (extra = {}) => ({
    id: 1, user_id: 5, template: "booking_request", sms_values: { who: "مینا", day: "فردا", time: "۱۰:۰۰" }, payer_user_id: null,
    booking_kind: "salon", booking_id: 41, booking_status: "درخواست", booking_date: "1499-01-01", booking_time: "10:00",
    phone: "09120000009", seen: false, ...extra
  });

  it("sends when they did not open frfro and the request still waits", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    due.rows = [row()];
    expect(await bookingSms.sendDueSmsBackups()).toEqual({ sent: 1, skipped: 0 });
    expect(sms).toHaveBeenCalledWith("09120000009", "booking_request", { who: "مینا", day: "فردا", time: "۱۰:۰۰" });
    expect(outcomes).toEqual([[1, "sent"]]);
  });

  it("sends nothing when they opened frfro, or the salon already answered", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    due.rows = [row({ id: 1, seen: true }), row({ id: 2, booking_status: "درخواست" })];
    status.value = "تایید شده";
    expect(await bookingSms.sendDueSmsBackups()).toEqual({ sent: 0, skipped: 2 });
    expect(sms).not.toHaveBeenCalled();
    expect(outcomes).toEqual([[1, "seen"], [2, "changed"]]);
  });

  it("an answer is charged to the payer like the SMS it replaces", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    status.value = "تایید شده";
    due.rows = [row({ template: "booking_answer", booking_status: "تایید شده", payer_user_id: 7 })];
    await bookingSms.sendDueSmsBackups();
    expect(charge).toHaveBeenCalledWith(7, { reminder: false });
    expect(sms).toHaveBeenCalledWith("09120000009", "booking_answer", expect.any(Object));
  });

  it("skips a booking whose time has passed", () => {
    expect(bookingSms.smsBackupSkipReason(row({ booking_date: formatPersianDateKey(new Date(Date.now() - 3 * 86400000)) }), "درخواست")).toBe("past");
    expect(bookingSms.smsBackupSkipReason(row(), "درخواست")).toBe("");
    expect(bookingSms.smsBackupSkipReason(row(), null)).toBe("changed");
  });
});
