import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { adminClient, createClient, futureBookingDay, joinSalonAsArtist, registerUser } from "./helpers.js";
import { TEST_ADMIN_PHONE, TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";

/**
 * Subscriptions end to end, on the real server with the test gateway (FRFRO_PAYMENT_GATEWAY=sandbox, see
 * globalSetup.js): checkout -> pretend bank -> callback -> verify -> receipt, and everything that must NOT happen
 * (paying twice for one transfer, a forged callback, a wrong amount, closing an account while nobody can pay).
 */
const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
const connected = db.connect();
const DAY = 86_400_000;
const uniq = () => Math.random().toString(36).slice(2, 8);

async function put(client, path, body) {
  const res = await fetch(`${TEST_BASE_URL}${path}`, { method: "PUT", headers: { "Content-Type": "application/json", Cookie: client.cookie() }, body: JSON.stringify(body) });
  return { status: res.status, ok: res.ok, payload: await res.json().catch(() => ({})) };
}

// The password re-check (step-up) is rate limited per admin and shared with the other admin test files, so these
// tests grant it straight in the database; one test below checks that the server really demands it.
const setStepUp = async (on) => {
  await connected;
  await db.query(
    "UPDATE admin_account_sessions SET stepup_until = $2 WHERE admin_id = (SELECT id FROM admin_accounts WHERE phone = $1)",
    [TEST_ADMIN_PHONE, on ? new Date(Date.now() + 10 * 60_000).toISOString() : null]
  );
};

async function setBilling(enabled, extra = {}) {
  const admin = await adminClient();
  await setStepUp(true);
  const saved = await put(admin, "/api/admin/billing/settings", { enabled, graceDays: 3, ...extra });
  expect(saved.ok).toBe(true);
  return saved.payload.data.settings;
}

async function provider(type, name) {
  const client = createClient();
  const account = await registerUser(client, { type, name: `${name} ${uniq()}` });
  return { client, ...account };
}

/** Checkout -> the pretend bank answers `action` -> the bank sends the payer back. Returns what the payer sees. */
async function payWithSandbox(client, plan, action = "pay", extra = {}) {
  const start = await client.post("/api/billing/checkout", { plan, ...extra });
  expect(start.status).toBe(201);
  const { paymentId, redirect } = start.payload.data;
  expect(redirect.method).toBe("GET");
  const authority = redirect.url.split("/pay/sandbox/")[1];
  expect(authority).toMatch(/^SBX[0-9A-F]{24}$/);
  const bank = await createClient().get(`/api/billing/sandbox/${authority}`);
  expect(bank.payload.data.status).toBe("pending");
  const answered = await createClient().post(`/api/billing/sandbox/${authority}`, { action });
  expect(answered.ok).toBe(true);
  const callbackUrl = answered.payload.data.redirect;
  const back = await fetch(callbackUrl, { redirect: "manual" });
  expect(back.status).toBe(303);
  const token = new URL(back.headers.get("location")).pathname.split("/pay/")[1];
  const result = await createClient().get(`/api/billing/return/${token}`);
  return { paymentId, authority, callbackUrl, token, result: result.payload.data.payment };
}

async function smsFor(phone, purpose, waitMs = 4000) {
  const until = Date.now() + waitMs;
  for (;;) {
    const { rows } = await db.query("SELECT body FROM sms_log WHERE phone = $1 AND purpose = $2 ORDER BY id DESC", [phone, purpose]);
    if (rows.length || Date.now() > until) return rows;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function cron(now = new Date()) {
  const res = await fetch(`${TEST_BASE_URL}/api/cron/billing`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TEST_CRON_SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify({ now: now.toISOString() })
  });
  return { status: res.status, data: (await res.json()).data };
}

const age = (userId, days) => db.query("UPDATE users SET created_at = NOW() - ($2::int * INTERVAL '1 day') WHERE id = $1", [userId, days]);

beforeAll(async () => {
  await connected;
  // Billing "launched" 60 days ago, so an account made 40 days ago has used up its free month.
  const launchedAt = new Date(Date.now() - 60 * DAY).toISOString();
  await db.query(`
    INSERT INTO app_settings (key, value) VALUES ('billing', $1::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `, [JSON.stringify({ enabled: false, launchedAt, graceDays: 3 })]);
});

afterAll(async () => {
  // Leave billing off so no other test file meets a closed account, and the shared admin session without a re-check.
  await setBilling(false);
  await setStepUp(false);
  await db.end();
});

describe("subscriptions: off by default", () => {
  it("shows clients nothing and refuses checkout while billing is off", async () => {
    const clientUser = createClient();
    await registerUser(clientUser, { type: "client", name: "Billing Client" });
    expect((await clientUser.get("/api/billing")).payload.data).toEqual({ visible: false });
    expect((await clientUser.post("/api/billing/checkout", { plan: "salon_1m" })).status).toBe(403);

    const salon = await provider("salon", "Off Salon");
    expect((await salon.client.get("/api/billing")).payload.data.visible).toBe(false);
    const refused = await salon.client.post("/api/billing/checkout", { plan: "salon_1m" });
    expect(refused.status).toBe(409);
    expect(refused.payload.code).toBe("BILLING_OFF");
  });

  it("needs a session for everything but the gateway's return", async () => {
    const anon = createClient();
    expect((await anon.get("/api/billing")).status).toBe(401);
    expect((await anon.post("/api/billing/checkout", { plan: "salon_1m" })).status).toBe(401);
    expect((await anon.get("/api/billing/payments")).status).toBe(401);
    expect((await anon.get("/api/admin/billing")).status).toBe(403);
  });

  it("asks the admin for the password again before switching billing or adding days", async () => {
    const admin = await adminClient();
    await setStepUp(false);
    const res = await put(admin, "/api/admin/billing/settings", { enabled: true, graceDays: 3 });
    expect(res.status).toBe(403);
    expect(res.payload.code).toBe("stepup_required");
    const grant = await admin.post("/api/admin/billing/grant", { userId: 1, days: 1, amountToman: 0, note: "هدیه" });
    expect(grant.payload.code).toBe("stepup_required");
    expect((await admin.get("/api/admin/billing")).payload.data.settings.enabled).toBe(false);
  });
});

describe("subscriptions: buying a plan", () => {
  let salon;
  beforeAll(async () => {
    const settings = await setBilling(true);
    expect(settings.enabled).toBe(true);
    // Switching on keeps the launch date it already had.
    expect(new Date(settings.launchedAt).getTime()).toBeLessThan(Date.now() - 59 * DAY);
    salon = await provider("salon", "Pay Salon");
  });

  it("offers the three plans with the owner's prices and dates", async () => {
    const overview = (await salon.client.get("/api/billing")).payload.data;
    expect(overview).toMatchObject({ visible: true, enabled: true, checkoutReady: true, enforced: true, sandbox: true, trialDays: 14 });
    expect(overview.account.state).toBe("trial");
    // Made after billing launched, so it has the 14 days for new accounts (accounts older than billing get 30 from launch).
    expect(overview.account.daysLeft).toBe(14);
    expect(overview.plans.map((plan) => [plan.id, plan.amountToman, plan.days, plan.preselected])).toEqual([
      ["salon_1m", 500_000, 30, false],
      ["salon_6m", 2_500_000, 180, true],
      ["salon_12m", 4_500_000, 365, false]
    ]);
    // A plan bought in the free month starts when the free month ends.
    expect(overview.plans[1].startsAt).toBe(overview.account.accessEndsAt);
  });

  it("refuses a plan of the other role", async () => {
    const res = await salon.client.post("/api/billing/checkout", { plan: "artist_1m" });
    expect(res.status).toBe(400);
    expect((await salon.client.post("/api/billing/checkout", { plan: "salon_2m" })).status).toBe(400);
  });

  it("pays, extends after the free month, and hands out a receipt", async () => {
    const before = (await salon.client.get("/api/billing")).payload.data.account;
    const { paymentId, result, callbackUrl, token } = await payWithSandbox(salon.client, "salon_6m");
    expect(result.status).toBe("paid");
    expect(result.receiptNo).toMatch(/^FR-14\d\d-\d{6}$/);
    expect(result.amountToman).toBe(2_500_000);
    expect(result.sandbox).toBe(true);
    expect(new Date(result.periodEnd).getTime()).toBe(new Date(before.accessEndsAt).getTime() + 180 * DAY);

    const after = (await salon.client.get("/api/billing")).payload.data;
    expect(after.account.state).toBe("active");
    expect(after.account.paidUntil).toBe(result.periodEnd);
    expect(after.pending).toBeNull();

    // The same bank transfer coming back again changes nothing.
    const replay = await fetch(callbackUrl, { redirect: "manual" });
    expect(new URL(replay.headers.get("location")).pathname).toBe(`/pay/${token}`);
    const again = (await salon.client.get("/api/billing")).payload.data.account;
    expect(again.paidUntil).toBe(after.account.paidUntil);

    const receipt = await salon.client.get(`/api/billing/payments/${paymentId}`);
    expect(receipt.payload.data.payment).toMatchObject({ status: "paid", receiptNo: result.receiptNo, title: "اشتراک شش‌ماهه سالن" });
    expect((await salon.client.get("/api/billing/payments")).payload.data.payments[0].id).toBe(paymentId);

    // Someone else's receipt is not found.
    const other = await provider("salon", "Nosy Salon");
    expect((await other.client.get(`/api/billing/payments/${paymentId}`)).status).toBe(404);

    // The payer gets a receipt SMS and each admin a "new payment" SMS (test SMS provider records them).
    const receiptSms = await smsFor(salon.phone, "billing_receipt");
    expect(receiptSms[0]?.body).toContain(result.receiptNo);
    expect((await smsFor(TEST_ADMIN_PHONE, "billing_admin"))[0]?.body).toContain(result.receiptNo);
  });

  it("adds a second plan after the first one", async () => {
    const before = (await salon.client.get("/api/billing")).payload.data.account;
    const { result } = await payWithSandbox(salon.client, "salon_1m");
    expect(result.status).toBe("paid");
    expect(new Date(result.periodEnd).getTime()).toBe(new Date(before.accessEndsAt).getTime() + 30 * DAY);
  });

  it("lets the admin record a refund once, taking the unused days off", async () => {
    const before = (await salon.client.get("/api/billing")).payload.data.account;
    const { paymentId, result } = await payWithSandbox(salon.client, "salon_1m");
    const admin = await adminClient();
    const detail = (await admin.get(`/api/admin/billing/payments/${paymentId}`)).payload.data.payment;
    // Bought ahead (the earlier plans still run), so the policy gives everything back.
    expect(detail.refundQuote).toEqual({ days: 30, amountToman: 500_000 });

    await setStepUp(false);
    const body = { action: "refund", amountToman: 500_000, days: 30, note: "انصراف در ۷ روز" };
    expect((await admin.post(`/api/admin/billing/payments/${paymentId}`, body)).payload.code).toBe("stepup_required");
    await setStepUp(true);
    expect((await admin.post(`/api/admin/billing/payments/${paymentId}`, { ...body, amountToman: 600_000 })).status).toBe(400);
    const done = await admin.post(`/api/admin/billing/payments/${paymentId}`, body);
    expect(done.ok).toBe(true);
    expect(done.payload.data.payment).toMatchObject({ refundToman: 500_000, refundDays: 30, refundQuote: null });
    expect((await admin.post(`/api/admin/billing/payments/${paymentId}`, body)).status).toBe(409);

    // The days are gone again, and the payer's receipt says so.
    expect((await salon.client.get("/api/billing")).payload.data.account.accessEndsAt).toBe(before.accessEndsAt);
    const receipt = (await salon.client.get(`/api/billing/payments/${paymentId}`)).payload.data.payment;
    expect(receipt).toMatchObject({ status: "paid", refundToman: 500_000, refundDays: 30 });
    expect(result.receiptNo).toBe(receipt.receiptNo);
  });

  it("records a cancelled payment as failed, without extending anything", async () => {
    const before = (await salon.client.get("/api/billing")).payload.data.account;
    const { result } = await payWithSandbox(salon.client, "salon_12m", "cancel");
    expect(result.status).toBe("failed");
    expect(result.receiptNo).toBe("");
    expect((await salon.client.get("/api/billing")).payload.data.account.paidUntil).toBe(before.paidUntil);
  });

  it("never trusts a callback whose gateway token does not match", async () => {
    const start = await salon.client.post("/api/billing/checkout", { plan: "salon_1m" });
    const { paymentId, redirect } = start.payload.data;
    const authority = redirect.url.split("/pay/sandbox/")[1];
    await createClient().post(`/api/billing/sandbox/${authority}`, { action: "pay" });
    const forged = await fetch(`${TEST_BASE_URL}/api/billing/callback/sandbox?pid=${paymentId}&Authority=SBXFAKE&Status=OK`, { redirect: "manual" });
    expect(new URL(forged.headers.get("location")).pathname).toBe("/pay/invalid");
    const wrongGateway = await fetch(`${TEST_BASE_URL}/api/billing/callback/zarinpal?pid=${paymentId}&Authority=${authority}&Status=OK`, { redirect: "manual" });
    expect(new URL(wrongGateway.headers.get("location")).pathname).toBe("/pay/invalid");
    await connected;
    const { rows } = await db.query("SELECT status FROM payments WHERE id = $1", [paymentId]);
    expect(rows[0].status).toBe("pending");
    expect((await createClient().get("/api/billing/return/not-a-real-token")).status).toBe(404);
  });

  it("refuses a payment whose amount does not match", async () => {
    const before = (await salon.client.get("/api/billing")).payload.data.account;
    const { result } = await payWithSandbox(salon.client, "salon_1m", "pay-wrong-amount");
    expect(result.status).toBe("failed");
    expect(result.failure).toContain("مبلغ");
    expect((await salon.client.get("/api/billing")).payload.data.account.paidUntil).toBe(before.paidUntil);
  });

  it("works the same through a posted form (bank gateways that POST back)", async () => {
    const artist = await provider("artist", "Post Artist");
    const start = await artist.client.post("/api/billing/checkout", { plan: "artist_1m" });
    const authority = start.payload.data.redirect.url.split("/pay/sandbox/")[1];
    const answered = await createClient().post(`/api/billing/sandbox/${authority}`, { action: "pay" });
    const url = new URL(answered.payload.data.redirect);
    const form = new URLSearchParams({ Authority: url.searchParams.get("Authority"), Status: "OK" });
    url.searchParams.delete("Authority");
    url.searchParams.delete("Status");
    const back = await fetch(url, { method: "POST", body: form, redirect: "manual" });
    expect(back.status).toBe(303);
    const token = new URL(back.headers.get("location")).pathname.split("/pay/")[1];
    const result = (await createClient().get(`/api/billing/return/${token}`)).payload.data.payment;
    expect(result).toMatchObject({ status: "paid", amountToman: 300_000 });
  });
});

describe("subscriptions: what a closed account loses", () => {
  let salon;
  let booker;
  beforeAll(async () => {
    await setBilling(true);
    salon = await provider("salon", "Closed Salon");
    await salon.client.get("/api/salon-hours");
    booker = createClient();
    await registerUser(booker, { type: "client", name: "Closed Booker" });
  });

  const bookingBody = () => ({ salonUserId: salon.user.id, service: "کوتاهی مو", bookingDate: futureBookingDay(2), time: "۱۰:۰۰", client: "Closed Booker", phone: "09120000000" });
  const listed = async () => {
    const page = (await createClient().get("/api/salons?limit=50")).payload.data.salons;
    return page.some((item) => Number(item.id) === Number(salon.user.id));
  };

  it("keeps a salon in its free month listed and bookable", async () => {
    expect(await listed()).toBe(true);
    const search = (await booker.get(`/api/connections/search?q=${encodeURIComponent(salon.user.name)}`)).payload.data;
    expect(search.results.some((item) => Number(item.id) === Number(salon.user.id))).toBe(true);
    expect((await createClient().get(`/api/salons/${salon.user.id}`)).payload.data.salon.onlineBookingPaused).toBe(false);
  });

  it("after the free month and grace: out of the directory and name search, no new online bookings", async () => {
    await age(salon.user.id, 40);
    const state = (await salon.client.get("/api/billing")).payload.data.account;
    expect(state).toMatchObject({ state: "expired", open: false });

    expect(await listed()).toBe(false);
    const search = (await booker.get(`/api/connections/search?q=${encodeURIComponent(salon.user.name)}`)).payload.data;
    expect(search.results.some((item) => Number(item.id) === Number(salon.user.id))).toBe(false);
    expect((await createClient().get(`/api/salons/${salon.user.id}`)).payload.data.salon.onlineBookingPaused).toBe(true);

    const refused = await booker.post("/api/salon-bookings", bookingBody());
    expect(refused.status).toBe(403);
    expect(refused.payload.code).toBe("PROVIDER_INACTIVE");
  });

  it("comes back the moment it pays", async () => {
    const { result } = await payWithSandbox(salon.client, "salon_1m");
    expect(result.status).toBe("paid");
    // Paid from today (the grace days are not charged for).
    expect(Math.abs(new Date(result.periodEnd).getTime() - (Date.now() + 30 * DAY))).toBeLessThan(5 * 60_000);
    expect(await listed()).toBe(true);
    const booked = await booker.post("/api/salon-bookings", bookingBody());
    expect(booked.payload.code).not.toBe("PROVIDER_INACTIVE");
  });

  it("does not exempt an artist for being on a paying salon's team; the salon may pay for them", async () => {
    const artist = await provider("artist", "Team Artist");
    await age(artist.user.id, 40);
    expect((await joinSalonAsArtist(artist.client, salon.client, salon.user.id)).ok).toBe(true);
    // Joining a salon that pays changes nothing for the artist.
    expect((await artist.client.get("/api/billing")).payload.data.account).toMatchObject({ state: "expired", open: false });
    expect((await createClient().get(`/api/artists/${artist.user.id}`)).payload.data.artist.onlineBookingPaused).toBe(true);

    // The salon sees its team with the artist plans for each artist.
    const overview = (await salon.client.get("/api/billing")).payload.data;
    const member = overview.team.find((item) => Number(item.id) === Number(artist.user.id));
    expect(member.account.state).toBe("expired");
    expect(member.plans.map((plan) => plan.id)).toEqual(["artist_1m", "artist_6m", "artist_12m"]);

    // Only for an artist on its own team, only with an artist plan, and only a salon can pay for someone else.
    const stranger = await provider("artist", "Stranger Artist");
    const notTeam = await salon.client.post("/api/billing/checkout", { plan: "artist_1m", forUserId: stranger.user.id });
    expect([notTeam.status, notTeam.payload.code]).toEqual([403, "NOT_TEAM"]);
    const wrongPlan = await salon.client.post("/api/billing/checkout", { plan: "salon_1m", forUserId: artist.user.id });
    expect([wrongPlan.status, wrongPlan.payload.code]).toEqual([400, "BAD_PLAN"]);
    const notSalon = await stranger.client.post("/api/billing/checkout", { plan: "artist_1m", forUserId: artist.user.id });
    expect([notSalon.status, notSalon.payload.code]).toEqual([403, "NOT_SALON"]);

    const salonEndBefore = (await salon.client.get("/api/billing")).payload.data.account.accessEndsAt;
    const { paymentId, result } = await payWithSandbox(salon.client, "artist_1m", "pay", { forUserId: artist.user.id });
    expect(result.status).toBe("paid");
    expect(result.amountToman).toBe(300_000);

    // The artist is open again; the salon's own subscription did not move.
    expect((await artist.client.get("/api/billing")).payload.data.account).toMatchObject({ state: "active", open: true });
    expect((await createClient().get(`/api/artists/${artist.user.id}`)).payload.data.artist.onlineBookingPaused).toBe(false);
    const salonAfter = (await salon.client.get("/api/billing")).payload.data;
    expect(salonAfter.account.accessEndsAt).toBe(salonEndBefore);
    expect(salonAfter.lastPayment.plan).toBe("salon_1m");

    // Both see the receipt, each from their side; nobody else does.
    const forSalon = (await salon.client.get(`/api/billing/payments/${paymentId}`)).payload.data.payment;
    expect(forSalon.paidFor).toBe(artist.user.name);
    expect(forSalon.paidBy).toBe("");
    const forArtist = (await artist.client.get(`/api/billing/payments/${paymentId}`)).payload.data.payment;
    expect(forArtist.paidBy).toBeTruthy();
    expect(forArtist.paidFor).toBe("");
    expect((await artist.client.get("/api/billing/payments")).payload.data.payments.some((item) => item.id === paymentId)).toBe(true);
    expect((await stranger.client.get(`/api/billing/payments/${paymentId}`)).status).toBe(404);

    // The receipt SMS goes to the one who paid.
    expect((await smsFor(salon.phone, "billing_receipt")).some((row) => row.body.includes(result.receiptNo))).toBe(true);
    expect(await smsFor(artist.phone, "billing_receipt", 500)).toEqual([]);

    // The admin ledger names both.
    const admin = await adminClient();
    const detail = (await admin.get(`/api/admin/billing/payments/${paymentId}`)).payload.data.payment;
    expect(detail).toMatchObject({ userId: artist.user.id, payerUserId: salon.user.id });
  });

  it("closes an independent artist the same way", async () => {
    const artist = await provider("artist", "Solo Artist");
    await age(artist.user.id, 40);
    expect((await createClient().get(`/api/artists/${artist.user.id}`)).payload.data.artist.onlineBookingPaused).toBe(true);
    const refused = await booker.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "کاشت ناخن", bookingDate: futureBookingDay(2), time: "۱۱:۰۰" });
    expect(refused.status).toBe(403);
    expect(refused.payload.code).toBe("PROVIDER_INACTIVE");
  });

  it("closes nobody while billing is off", async () => {
    const solo = await provider("artist", "Off Artist");
    await age(solo.user.id, 40);
    await setBilling(false);
    expect((await createClient().get(`/api/artists/${solo.user.id}`)).payload.data.artist.onlineBookingPaused).toBe(false);
    await setBilling(true);
    expect((await createClient().get(`/api/artists/${solo.user.id}`)).payload.data.artist.onlineBookingPaused).toBe(true);
  });
});

describe("subscriptions: hourly sweep", () => {
  beforeAll(async () => {
    await setBilling(true);
  });

  it("is locked to the scheduler", async () => {
    expect((await fetch(`${TEST_BASE_URL}/api/cron/billing`, { method: "POST" })).status).toBe(401);
  });

  it("reminds once, five days before the free month ends", async () => {
    const salon = await provider("salon", "Reminder Salon");
    await age(salon.user.id, 11);
    const first = await cron();
    expect(first.status).toBe(200);
    expect(first.data.reminders).toBeGreaterThanOrEqual(1);
    await connected;
    const notices = await db.query("SELECT kind FROM billing_notices WHERE user_id = $1", [salon.user.id]);
    expect(notices.rows.map((row) => row.kind)).toEqual(["ends_5d"]);
    expect((await smsFor(salon.phone, "billing_reminder"))[0]?.body).toContain("۳ روز");
    await cron();
    expect((await db.query("SELECT COUNT(*)::int AS n FROM billing_notices WHERE user_id = $1", [salon.user.id])).rows[0].n).toBe(1);
  });

  it("settles a payment whose payer never came back", async () => {
    const salon = await provider("salon", "Gone Salon");
    const start = await salon.client.post("/api/billing/checkout", { plan: "salon_1m" });
    const { paymentId, redirect } = start.payload.data;
    const authority = redirect.url.split("/pay/sandbox/")[1];
    await createClient().post(`/api/billing/sandbox/${authority}`, { action: "pay" });
    // The browser closed on the way back: no callback. An hour later the sweep asks the gateway.
    await db.query("UPDATE payments SET created_at = NOW() - INTERVAL '1 hour' WHERE id = $1", [paymentId]);
    const swept = await cron();
    expect(swept.data.paid).toBeGreaterThanOrEqual(1);
    expect((await salon.client.get(`/api/billing/payments/${paymentId}`)).payload.data.payment.status).toBe("paid");
  });

  it("closes checkouts that never reached the gateway", async () => {
    const salon = await provider("salon", "Stuck Salon");
    const { rows } = await db.query(`
      INSERT INTO payments (user_id, user_type, plan, plan_title, days, amount_rial, gateway, created_at)
      VALUES ($1, 'salon', 'salon_1m', 'x', 30, 5000000, 'sandbox', NOW() - INTERVAL '2 hours') RETURNING id
    `, [salon.user.id]);
    await cron();
    expect((await db.query("SELECT status FROM payments WHERE id = $1", [rows[0].id])).rows[0].status).toBe("failed");
  });
});

describe("subscriptions: admin", () => {
  let salon;
  beforeAll(async () => {
    await setBilling(true);
    salon = await provider("salon", "Admin Salon");
  });

  it("lists payments with stats, and leaves test payments out of revenue", async () => {
    const admin = await adminClient();
    const before = (await admin.get("/api/admin/billing")).payload.data;
    expect(before.gateway).toMatchObject({ selected: "sandbox", ready: true, sandbox: true });
    expect(before.settings.enabled).toBe(true);
    expect(before.sms.templates.find((item) => item.key === "billing_receipt").configured).toBe(true);
    const { paymentId } = await payWithSandbox(salon.client, "salon_1m");
    const after = (await admin.get("/api/admin/billing?status=paid")).payload.data;
    expect(after.payments.some((payment) => payment.id === paymentId)).toBe(true);
    expect(after.stats.revenue.monthToman).toBe(before.stats.revenue.monthToman);
    const detail = (await admin.get(`/api/admin/billing/payments/${paymentId}`)).payload.data;
    expect(detail.payment).toMatchObject({ id: paymentId, status: "paid", userPhone: salon.phone, sandbox: true });
    expect(detail.account.state).toBe("active");
    expect((await createClient().get(`/api/admin/billing/payments/${paymentId}`)).status).toBe(403);
  });

  it("adds days (gift or money taken outside the app) with the password and a log entry", async () => {
    const admin = await adminClient();
    const before = (await admin.get(`/api/admin/billing/accounts/${salon.user.id}`)).payload.data.account;
    const revenueBefore = (await admin.get("/api/admin/billing")).payload.data.stats.revenue.monthToman;
    await setStepUp(true);
    const granted = await admin.post("/api/admin/billing/grant", { userId: salon.user.id, days: 10, amountToman: 100_000, note: "کارت‌به‌کارت آزمایشی" });
    expect(granted.status).toBe(201);
    expect(granted.payload.data.payment).toMatchObject({ source: "admin", status: "paid", amountToman: 100_000, days: 10 });
    expect(new Date(granted.payload.data.account.accessEndsAt).getTime()).toBe(new Date(before.accessEndsAt).getTime() + 10 * DAY);
    expect((await admin.get("/api/admin/billing")).payload.data.stats.revenue.monthToman).toBe(revenueBefore + 100_000);
    const log = (await admin.get(`/api/admin/actions?group=billing&user=${salon.user.id}`)).payload.data.actions;
    expect(log.some((row) => row.action === "billing_grant")).toBe(true);
    // The salon sees it in its own history.
    expect((await salon.client.get("/api/billing/payments")).payload.data.payments[0]).toMatchObject({ source: "admin", amountToman: 100_000 });

    const clientUser = createClient();
    const clientAccount = await registerUser(clientUser, { type: "client", name: "Grant Client" });
    const refused = await admin.post("/api/admin/billing/grant", { userId: clientAccount.user.id, days: 10, amountToman: 0, note: "هدیه" });
    expect(refused.status).toBe(400);
    expect((await admin.post("/api/admin/billing/grant", { userId: salon.user.id, days: 0, amountToman: 0, note: "هدیه" })).status).toBe(400);
    expect((await admin.post("/api/admin/billing/grant", { userId: salon.user.id, days: 5, amountToman: 0, note: "" })).status).toBe(400);
  });

  it("asks the gateway again about a pending payment on demand", async () => {
    const admin = await adminClient();
    const start = await salon.client.post("/api/billing/checkout", { plan: "salon_1m" });
    const { paymentId, redirect } = start.payload.data;
    const authority = redirect.url.split("/pay/sandbox/")[1];
    let detail = (await admin.post(`/api/admin/billing/payments/${paymentId}`, { action: "reverify" })).payload.data;
    expect(detail.payment.status).toBe("pending");
    await createClient().post(`/api/billing/sandbox/${authority}`, { action: "pay" });
    detail = (await admin.post(`/api/admin/billing/payments/${paymentId}`, { action: "reverify" })).payload.data;
    expect(detail.payment.status).toBe("paid");
    expect((await admin.post(`/api/admin/billing/payments/${paymentId}`, { action: "reverify" })).status).toBe(409);
  });

  it("shows the new payment on the rail badge and the overview feed", async () => {
    const admin = await adminClient();
    expect((await admin.get("/api/admin/me")).payload.data.paidToday).toBeGreaterThan(0);
    const feed = (await admin.get("/api/admin/dashboard")).payload.data.feed;
    expect(feed.some((item) => item.kind === "payment")).toBe(true);
  });
});
