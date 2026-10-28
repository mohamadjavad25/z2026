import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { adminClient, createClient, futureBookingDay, registerUser, joinSalonAsArtist } from "./helpers.js";
import { TEST_ADMIN_PHONE, TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";
import { bookingStartMs } from "../../app/shared/lib/reminderTiming.js";

/**
 * SMS packs end to end (owner's decisions of 2026-10-28), on the real server with the test gateway: 200 SMS a month
 * for each salon and artist account, packs bought through the same checkout as a plan, who pays for a client's SMS,
 * and what happens when the account runs out. Money rules are the same as for plans (billing.test.js): a pack is paid
 * only when the gateway says so, once, for exactly its price.
 */
const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
const connected = db.connect();
const DAY = 86_400_000;
const uniq = () => Math.random().toString(36).slice(2, 8);

async function put(client, path, body) {
  const res = await fetch(`${TEST_BASE_URL}${path}`, { method: "PUT", headers: { "Content-Type": "application/json", Cookie: client.cookie() }, body: JSON.stringify(body) });
  return { status: res.status, ok: res.ok, payload: await res.json().catch(() => ({})) };
}

const setStepUp = async (on) => {
  await connected;
  await db.query(
    "UPDATE admin_account_sessions SET stepup_until = $2 WHERE admin_id = (SELECT id FROM admin_accounts WHERE phone = $1)",
    [TEST_ADMIN_PHONE, on ? new Date(Date.now() + 10 * 60_000).toISOString() : null]
  );
};

async function setBilling(enabled) {
  const admin = await adminClient();
  await setStepUp(true);
  const saved = await put(admin, "/api/admin/billing/settings", { enabled, graceDays: 3 });
  expect(saved.ok).toBe(true);
}

async function provider(type, name, extra = {}) {
  const client = createClient();
  const account = await registerUser(client, { type, name: `${name} ${uniq()}`, ...extra });
  return { client, ...account };
}

/** Checkout of a pack -> the pretend bank answers `action` -> the bank sends the payer back. */
async function buyPack(client, pack, action = "pay") {
  const start = await client.post("/api/billing/checkout", { pack });
  expect(start.status).toBe(201);
  const { paymentId, redirect } = start.payload.data;
  const authority = redirect.url.split("/pay/sandbox/")[1];
  const answered = await createClient().post(`/api/billing/sandbox/${authority}`, { action });
  const callbackUrl = answered.payload.data.redirect;
  const back = await fetch(callbackUrl, { redirect: "manual" });
  expect(back.status).toBe(303);
  const token = new URL(back.headers.get("location")).pathname.split("/pay/")[1];
  const result = (await createClient().get(`/api/billing/return/${token}`)).payload.data.payment;
  return { paymentId, callbackUrl, token, result };
}

const sms = async (client) => (await client.get("/api/billing")).payload.data.sms;
const wallet = async (userId) => {
  await connected;
  const { rows } = await db.query("SELECT period_key, included_used, pack_credits FROM sms_wallet WHERE user_id = $1", [userId]);
  return rows[0] ? { used: rows[0].included_used, packs: rows[0].pack_credits, period: rows[0].period_key } : null;
};

async function smsTo(phone, purpose, { wait = 4000 } = {}) {
  const until = Date.now() + wait;
  for (;;) {
    const { rows } = await db.query("SELECT body FROM sms_log WHERE phone = $1 AND purpose = $2 ORDER BY id DESC", [phone, purpose]);
    if (rows.length || Date.now() > until) return rows.map((row) => row.body);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

/** A salon booking made by a new client, asked and answered; returns what the client was texted. */
async function bookAndConfirm(salon, clientPerson, time = "10:00") {
  const created = await clientPerson.client.post("/api/salon-bookings", {
    salonUserId: salon.user.id, service: "کوتاهی مو", bookingDate: futureBookingDay(2), time, client: clientPerson.user.name, phone: clientPerson.phone
  });
  expect(created.status).toBe(201);
  const approved = await salon.client.patch("/api/salon-bookings", { id: created.payload.data.booking.id, status: "تایید شده" });
  expect(approved.ok).toBe(true);
  return created.payload.data.booking;
}

beforeAll(async () => {
  await connected;
  const launchedAt = new Date(Date.now() - 60 * DAY).toISOString();
  await db.query(`
    INSERT INTO app_settings (key, value) VALUES ('billing', $1::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `, [JSON.stringify({ enabled: false, launchedAt, graceDays: 3 })]);
});

afterAll(async () => {
  await setBilling(false);
  await setStepUp(false);
  await db.end();
});

describe("SMS packs: off by default", () => {
  it("is closed to clients and refused while billing is off", async () => {
    const clientUser = await provider("client", "Pack Client");
    expect((await clientUser.client.post("/api/billing/checkout", { pack: "sms_100" })).status).toBe(403);
    const salon = await provider("salon", "Off Pack Salon");
    const refused = await salon.client.post("/api/billing/checkout", { pack: "sms_100" });
    expect(refused.status).toBe(409);
    expect(refused.payload.code).toBe("BILLING_OFF");
  });
});

describe("SMS packs: the wallet", () => {
  let salon;
  beforeAll(async () => {
    await setBilling(true);
    salon = await provider("salon", "Wallet Salon");
  });

  it("starts every account with its 200 a month and shows the packs", async () => {
    const view = await sms(salon.client);
    expect(view).toMatchObject({ included: 200, includedLeft: 200, packCredits: 0, left: 200, usedThisMonth: 0, state: "ok" });
    expect(view.packs.map((pack) => [pack.id, pack.credits, pack.amountToman])).toEqual([["sms_100", 100, 40_000], ["sms_300", 300, 105_000]]);
  });

  it("refuses a pack it does not sell, a pack with a plan, and a pack for someone else", async () => {
    expect((await salon.client.post("/api/billing/checkout", { pack: "sms_5" })).status).toBe(400);
    expect((await salon.client.post("/api/billing/checkout", { pack: "sms_100", plan: "salon_1m" })).status).toBe(400);
    const artist = await provider("artist", "Other Artist");
    expect((await salon.client.post("/api/billing/checkout", { pack: "sms_100", forUserId: artist.user.id })).status).toBe(400);
    expect((await createClient().post("/api/billing/checkout", { pack: "sms_100" })).status).toBe(401);
  });

  it("pays once for exactly the pack's price, credits the wallet and keeps the subscription as it is", async () => {
    const before = (await salon.client.get("/api/billing")).payload.data.account;
    const { paymentId, result, callbackUrl, token } = await buyPack(salon.client, "sms_100");
    expect(result).toMatchObject({ status: "paid", kind: "sms_pack", amountToman: 40_000, title: "بسته‌ی ۱۰۰ پیامک" });
    expect(result.receiptNo).toMatch(/^FR-14\d\d-\d{6}$/);
    expect(result.periodEnd).toBeNull();

    expect(await sms(salon.client)).toMatchObject({ packCredits: 100, left: 300 });
    expect((await salon.client.get("/api/billing")).payload.data.account.paidUntil).toBe(before.paidUntil);
    expect(await wallet(salon.user.id)).toMatchObject({ packs: 100 });

    // The same transfer coming back again changes nothing.
    const replay = await fetch(callbackUrl, { redirect: "manual" });
    expect(new URL(replay.headers.get("location")).pathname).toBe(`/pay/${token}`);
    expect(await wallet(salon.user.id)).toMatchObject({ packs: 100 });

    // The receipt shows as a pack, and no receipt SMS is spent on it (the admin still hears about the payment).
    const receipt = (await salon.client.get(`/api/billing/payments/${paymentId}`)).payload.data.payment;
    expect(receipt).toMatchObject({ kind: "sms_pack", smsCredits: 100, days: 0, receiptNo: result.receiptNo });
    expect(await smsTo(salon.phone, "billing_receipt", { wait: 600 })).toEqual([]);
    expect((await smsTo(TEST_ADMIN_PHONE, "billing_admin")).some((body) => body.includes(result.receiptNo))).toBe(true);
    // Someone else's receipt is not found.
    expect((await (await provider("salon", "Nosy Pack Salon")).client.get(`/api/billing/payments/${paymentId}`)).status).toBe(404);
  });

  it("does not credit a cancelled payment, a wrong amount, or a forged return", async () => {
    const before = await wallet(salon.user.id);
    const cancelled = await buyPack(salon.client, "sms_300", "cancel");
    expect(cancelled.result.status).toBe("failed");
    const wrong = await buyPack(salon.client, "sms_300", "pay-wrong-amount");
    expect(wrong.result.status).toBe("failed");
    expect(wrong.result.failure).toContain("مبلغ");

    const start = await salon.client.post("/api/billing/checkout", { pack: "sms_300" });
    const { paymentId, redirect } = start.payload.data;
    const authority = redirect.url.split("/pay/sandbox/")[1];
    await createClient().post(`/api/billing/sandbox/${authority}`, { action: "pay" });
    const forged = await fetch(`${TEST_BASE_URL}/api/billing/callback/sandbox?pid=${paymentId}&Authority=SBXFAKE&Status=OK`, { redirect: "manual" });
    expect(new URL(forged.headers.get("location")).pathname).toBe("/pay/invalid");
    expect(await wallet(salon.user.id)).toEqual(before);
  });

  it("lists a pack in «پرداخت‌هام» without making it the last subscription payment", async () => {
    const overview = (await salon.client.get("/api/billing")).payload.data;
    expect(overview.lastPayment).toBeNull();
    expect((await salon.client.get("/api/billing/payments")).payload.data.payments.some((payment) => payment.kind === "sms_pack")).toBe(true);
  });

  it("lets the admin refund a pack only whole and only while none of it is used, once", async () => {
    const { paymentId } = await buyPack(salon.client, "sms_100");
    expect((await wallet(salon.user.id)).packs).toBe(200);

    const admin = await adminClient();
    const detail = (await admin.get(`/api/admin/billing/payments/${paymentId}`)).payload.data.payment;
    expect(detail).toMatchObject({ kind: "sms_pack", smsCredits: 100, refundQuote: { days: 0, amountToman: 40_000 } });

    await setStepUp(true);
    const body = { action: "refund", amountToman: 40_000, days: 0, note: "انصراف در ۷ روز" };
    // Not a part of the price, and not days off a subscription.
    expect((await admin.post(`/api/admin/billing/payments/${paymentId}`, { ...body, amountToman: 20_000 })).status).toBe(400);
    expect((await admin.post(`/api/admin/billing/payments/${paymentId}`, { ...body, days: 5 })).status).toBe(400);

    // Less than this pack is left in the wallet, so some of it was used: the terms give nothing back, and nothing changes.
    await db.query("UPDATE sms_wallet SET pack_credits = 60 WHERE user_id = $1", [salon.user.id]);
    const refused = await admin.post(`/api/admin/billing/payments/${paymentId}`, body);
    expect(refused.status).toBe(409);
    expect(refused.payload.error).toContain("مصرف شده");
    expect((await wallet(salon.user.id)).packs).toBe(60);

    // All of it is still there: the refund takes exactly the pack's credits back, once.
    await db.query("UPDATE sms_wallet SET pack_credits = 200 WHERE user_id = $1", [salon.user.id]);
    const done = await admin.post(`/api/admin/billing/payments/${paymentId}`, body);
    expect(done.ok).toBe(true);
    expect(done.payload.data.payment).toMatchObject({ refundToman: 40_000, refundDays: 0, refundQuote: null });
    expect((await admin.post(`/api/admin/billing/payments/${paymentId}`, body)).status).toBe(409);
    expect((await wallet(salon.user.id)).packs).toBe(100);
  });
});

describe("SMS packs: who pays for a client's SMS", () => {
  let salon;
  beforeAll(async () => {
    await setBilling(true);
    salon = await provider("salon", "Payer Salon", { menu: true });
    await salon.client.get("/api/salon-hours");
  });

  it("charges an answer to a salon booking to the salon, and counts it", async () => {
    const person = await provider("client", "Pack Booker");
    await bookAndConfirm(salon, person, "10:00");
    expect((await smsTo(person.phone, "booking_answer")).length).toBe(1);
    expect(await wallet(salon.user.id)).toMatchObject({ used: 1, packs: 0 });
    expect(await sms(salon.client)).toMatchObject({ includedLeft: 199, left: 199, usedThisMonth: 1 });
  });

  it("takes from the packs once the month's 200 are used, and gives the SMS back when it never went", async () => {
    await db.query("UPDATE sms_wallet SET included_used = 200, pack_credits = 5 WHERE user_id = $1", [salon.user.id]);
    const person = await provider("client", "Pack Booker Two");
    await bookAndConfirm(salon, person, "12:00");
    expect((await smsTo(person.phone, "booking_answer")).length).toBe(1);
    expect(await wallet(salon.user.id)).toMatchObject({ used: 200, packs: 4 });
  });

  it("still sends the answer when everything is used up, at our cost, and keeps counting", async () => {
    await db.query("UPDATE sms_wallet SET included_used = 200, pack_credits = 0 WHERE user_id = $1", [salon.user.id]);
    const person = await provider("client", "Pack Booker Three");
    await bookAndConfirm(salon, person, "14:00");
    expect((await smsTo(person.phone, "booking_answer")).length).toBe(1);
    expect(await wallet(salon.user.id)).toMatchObject({ used: 201, packs: 0 });
    expect(await sms(salon.client)).toMatchObject({ left: 0, state: "empty" });
  });

  it("charges a booking the client made straight with an artist to that artist, even on a salon's team", async () => {
    const artist = await provider("artist", "Team Pack Artist", { menu: true });
    expect((await joinSalonAsArtist(artist.client, salon.client, salon.user.id)).ok).toBe(true);
    const person = await provider("client", "Pack Direct Booker");
    const before = await wallet(salon.user.id);
    const created = await person.client.post("/api/artist/bookings", {
      artistUserId: artist.user.id, service: "ناخن", bookingDate: futureBookingDay(2), time: "11:00"
    });
    expect(created.status).toBe(201);
    const bookingId = created.payload.data.booking.id;
    const answered = await artist.client.patch("/api/artist/me", { kind: "booking", id: bookingId, status: "تایید شده" });
    expect(answered.ok).toBe(true);
    expect((await smsTo(person.phone, "booking_answer")).length).toBe(1);
    // The artist's own wallet is charged; the salon's did not move.
    expect(await wallet(artist.user.id)).toMatchObject({ used: 1 });
    expect(await wallet(salon.user.id)).toEqual(before);
  });
});

describe("SMS packs: the reminder is the only SMS held back", () => {
  let salon;
  beforeAll(async () => {
    await setBilling(true);
    salon = await provider("salon", "Reminder Pack Salon", { menu: true });
    await salon.client.get("/api/salon-hours");
  });

  /** A confirmed visit and the sweep two hours before it (the client has no app or notification, so the SMS is due). */
  async function remindedVisit(time) {
    const person = await provider("client", "Pack Reminded");
    const day = futureBookingDay(2);
    const created = await person.client.post("/api/salon-bookings", {
      salonUserId: salon.user.id, service: "کوتاهی مو", bookingDate: day, time, client: person.user.name, phone: person.phone
    });
    expect(created.status).toBe(201);
    expect((await salon.client.patch("/api/salon-bookings", { id: created.payload.data.booking.id, status: "تایید شده" })).ok).toBe(true);
    const start = bookingStartMs(day, time, new Date());
    const res = await fetch(`${TEST_BASE_URL}/api/cron/send-reminders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TEST_CRON_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({ now: new Date(start - 90 * 60000).toISOString() })
    });
    expect(res.status).toBe(200);
    return person;
  }

  it("is sent and counted while the account has SMS left", async () => {
    await db.query("DELETE FROM sms_wallet WHERE user_id = $1", [salon.user.id]);
    const person = await remindedVisit("12:00");
    expect((await smsTo(person.phone, "booking_reminder")).length).toBe(1);
    // The answer SMS and the reminder each take one.
    expect((await wallet(salon.user.id)).used).toBe(2);
  });

  it("is held back once nothing is left, but the answer to the booking was still sent", async () => {
    await db.query("UPDATE sms_wallet SET included_used = 200, pack_credits = 0 WHERE user_id = $1", [salon.user.id]);
    const person = await remindedVisit("13:00");
    expect(await smsTo(person.phone, "booking_answer")).toHaveLength(1);
    expect(await smsTo(person.phone, "booking_reminder", { wait: 800 })).toEqual([]);
    // Only the answer was counted (over the 200, at our cost); the held reminder took nothing.
    expect((await wallet(salon.user.id)).used).toBe(201);
  });

  it("goes again after the account buys a pack", async () => {
    await db.query("UPDATE sms_wallet SET included_used = 200, pack_credits = 3 WHERE user_id = $1", [salon.user.id]);
    const person = await remindedVisit("14:00");
    expect((await smsTo(person.phone, "booking_reminder")).length).toBe(1);
    // The answer took one pack credit and the reminder another.
    expect((await wallet(salon.user.id)).packs).toBe(1);
  });

  it("changes nothing while billing is off: every SMS goes and none is counted, because nobody could buy a pack yet", async () => {
    await setBilling(false);
    await db.query("UPDATE sms_wallet SET included_used = 200, pack_credits = 0 WHERE user_id = $1", [salon.user.id]);
    const person = await remindedVisit("15:00");
    expect((await smsTo(person.phone, "booking_answer")).length).toBe(1);
    expect((await smsTo(person.phone, "booking_reminder")).length).toBe(1);
    expect((await wallet(salon.user.id)).used).toBe(200);
    await setBilling(true);
  });
});
