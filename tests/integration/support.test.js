import { describe, it, expect } from "vitest";
import { adminClient, createClient, registerUser, uniquePhone } from "./helpers.js";
import { TEST_ADMIN_PHONE } from "../globalSetup.js";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const LONG = "پیام آزمایشی برای پشتیبانی که از ده حرف بیشتر است.";

async function artistWithPost(title = "پست قابل گزارش") {
  const client = createClient();
  const artist = await registerUser(client, { type: "artist", name: "صاحب پست" });
  const created = await client.post("/api/posts", { title, tag: "ناخن", caption: "x", image: PNG });
  return { client, artist, post: created.payload.data.post };
}

describe("support messages (public)", () => {
  it("accepts a message from a signed-in user, and from a guest who leaves a phone", async () => {
    const user = createClient();
    const account = await registerUser(user, { type: "client", name: "پیام‌دهنده" });
    const sent = await user.post("/api/support", { category: "bug", subject: "خطا", message: LONG });
    expect(sent.status).toBe(201);
    expect(sent.payload.data.id).toBeGreaterThan(0);

    const guestPhone = uniquePhone();
    expect((await createClient().post("/api/support", { category: "account", message: LONG, phone: guestPhone })).status).toBe(201);

    const admin = await adminClient();
    const list = await admin.get(`/api/admin/support?status=open&q=${account.phone}`);
    expect(list.payload.data.tickets.some((ticket) => ticket.id === sent.payload.data.id && ticket.kind === "support" && ticket.user_name === "پیام‌دهنده")).toBe(true);
    const guest = await admin.get(`/api/admin/support?q=${guestPhone}`);
    expect(guest.payload.data.tickets[0].phone).toBe(guestPhone);
  });

  it("refuses too-short messages, and a guest without a usable phone", async () => {
    const guest = createClient();
    expect((await guest.post("/api/support", { message: "کوتاه", phone: uniquePhone() })).status).toBe(400);
    expect((await guest.post("/api/support", { message: LONG })).status).toBe(400);
    expect((await guest.post("/api/support", { message: LONG, phone: "123" })).status).toBe(400);
    expect((await guest.post("/api/support", { message: "ا".repeat(2001), phone: uniquePhone() })).status).toBe(400);
  });

  it("throttles one person's messages", async () => {
    const phone = uniquePhone();
    const statuses = [];
    for (let i = 0; i < 7; i += 1) statuses.push((await createClient().post("/api/support", { message: LONG, phone }, { headers: { "x-forwarded-for": `10.5.${i}.1` } })).status);
    expect(statuses.slice(0, 5).every((status) => status === 201)).toBe(true);
    expect(statuses[6]).toBe(429);
  });
});

describe("reports (public)", () => {
  it("needs a signed-in user and a valid target", async () => {
    const { post } = await artistWithPost();
    expect((await createClient().post("/api/reports", { targetType: "post", targetId: post.id, reason: "spam" })).status).toBe(401);
    const reporter = createClient();
    await registerUser(reporter, { type: "client", name: "گزارش‌دهنده" });
    expect((await reporter.post("/api/reports", { targetType: "post", targetId: post.id, reason: "nonsense" })).status).toBe(400);
    expect((await reporter.post("/api/reports", { targetType: "thing", targetId: post.id, reason: "spam" })).status).toBe(400);
    expect((await reporter.post("/api/reports", { targetType: "post", targetId: 999999999, reason: "spam" })).status).toBe(404);
    expect((await reporter.post("/api/reports", { targetType: "user", targetId: 999999999, reason: "spam" })).status).toBe(404);
  });

  it("can't report your own post or yourself, and a repeat report does not stack", async () => {
    const { client: owner, artist, post } = await artistWithPost();
    expect((await owner.post("/api/reports", { targetType: "post", targetId: post.id, reason: "spam" })).status).toBe(400);
    expect((await owner.post("/api/reports", { targetType: "user", targetId: artist.user.id, reason: "spam" })).status).toBe(400);

    const reporter = createClient();
    await registerUser(reporter, { type: "client", name: "گزارش‌دهندهٔ تکراری" });
    const first = await reporter.post("/api/reports", { targetType: "post", targetId: post.id, reason: "spam", note: "تبلیغ است" });
    expect(first.status).toBe(201);
    const again = await reporter.post("/api/reports", { targetType: "post", targetId: post.id, reason: "fake" });
    expect(again.status).toBe(200);
    expect(again.payload.data.already).toBe(true);
    expect(again.payload.data.id).toBe(first.payload.data.id);
  });
});

describe("support inbox (admin)", () => {
  it("is closed to everyone but an admin", async () => {
    const user = createClient();
    await registerUser(user, { type: "client", name: "عادی" });
    for (const client of [createClient(), user]) {
      expect((await client.get("/api/admin/support")).status).toBe(403);
      expect((await client.get("/api/admin/support/1")).status).toBe(403);
      expect((await client.post("/api/admin/support/1", { status: "closed" })).status).toBe(403);
    }
  });

  it("works a message: status changes, internal note, reopen, validation", async () => {
    const admin = await adminClient();
    const user = createClient();
    await registerUser(user, { type: "client", name: "کاربر پیگیری" });
    const { id } = (await user.post("/api/support", { category: "question", subject: "سؤال من", message: LONG })).payload.data;

    const detail = await admin.get(`/api/admin/support/${id}`);
    expect(detail.ok).toBe(true);
    expect(detail.payload.data.ticket.body).toBe(LONG);
    expect(detail.payload.data.target).toBeNull();

    expect((await admin.post(`/api/admin/support/${id}`, { status: "weird" })).status).toBe(400);
    expect((await admin.post(`/api/admin/support/${id}`, { status: "in_progress", note: "زنگ بزنم" })).ok).toBe(true);
    const progressed = (await admin.get(`/api/admin/support/${id}`)).payload.data.ticket;
    expect(progressed.status).toBe("in_progress");
    expect(progressed.admin_note).toBe("زنگ بزنم");

    expect((await admin.post(`/api/admin/support/${id}`, { status: "closed" })).ok).toBe(true);
    const closed = (await admin.get(`/api/admin/support/${id}`)).payload.data.ticket;
    expect(closed.status).toBe("closed");
    expect(closed.resolution).toBe("answered");
    expect(closed.closed_at).toBeTruthy();
    expect((await admin.post(`/api/admin/support/${id}`, { status: "open" })).ok).toBe(true);
    expect((await admin.get(`/api/admin/support/${id}`)).payload.data.ticket.closed_at).toBeNull();
    expect((await admin.post(`/api/admin/support/${id}`, { action: "dismiss" })).status).toBe(400); // actions are for reports only
    expect((await admin.get("/api/admin/support/999999999")).status).toBe(404);
  });

  it("acts on a post report: hide the post and close the ticket", async () => {
    const admin = await adminClient();
    const { post } = await artistWithPost("پست برای پنهان‌شدن");
    const reporter = createClient();
    await registerUser(reporter, { type: "client", name: "گزارش‌دهنده ۱" });
    const { id } = (await reporter.post("/api/reports", { targetType: "post", targetId: post.id, reason: "inappropriate", note: "ناخوشایند" })).payload.data;

    const detail = (await admin.get(`/api/admin/support/${id}`)).payload.data;
    expect(detail.ticket.kind).toBe("report");
    expect(detail.target.title).toBe("پست برای پنهان‌شدن");
    expect(detail.target.is_public).toBe(true);

    expect((await admin.post(`/api/admin/support/${id}`, { action: "hide_post", note: "پنهان شد" })).ok).toBe(true);
    const after = (await admin.get(`/api/admin/support/${id}`)).payload.data;
    expect(after.ticket.status).toBe("closed");
    expect(after.ticket.resolution).toBe("hidden_post");
    expect(after.target.is_public).toBe(false);
    const hidden = await admin.get(`/api/admin/posts?visibility=hidden&q=${encodeURIComponent("پست برای پنهان‌شدن")}`);
    expect(hidden.payload.data.total).toBe(1);
  });

  it("suspends the reported account (never an admin) and dismisses a report", async () => {
    const admin = await adminClient();
    const bad = createClient();
    const badUser = await registerUser(bad, { type: "client", name: "متخلف" });
    const reporter = createClient();
    await registerUser(reporter, { type: "client", name: "گزارش‌دهنده ۲" });

    const report = (await reporter.post("/api/reports", { targetType: "user", targetId: badUser.user.id, reason: "fake" })).payload.data.id;
    expect((await admin.post(`/api/admin/support/${report}`, { action: "suspend_user" })).ok).toBe(true);
    const blocked = await createClient().post("/api/auth/login", { phone: badUser.phone, password: "testpass123" });
    expect(blocked.status).toBe(403);
    expect(blocked.payload.code).toBe("suspended");

    const adminRow = (await admin.get(`/api/admin/users?q=${TEST_ADMIN_PHONE}`)).payload.data.users[0];
    const onAdmin = (await reporter.post("/api/reports", { targetType: "user", targetId: adminRow.id, reason: "other" })).payload.data.id;
    expect((await admin.post(`/api/admin/support/${onAdmin}`, { action: "suspend_user" })).status).toBe(400);
    expect((await admin.post(`/api/admin/support/${onAdmin}`, { action: "dismiss" })).ok).toBe(true);
    expect((await admin.get(`/api/admin/support/${onAdmin}`)).payload.data.ticket.resolution).toBe("dismissed");
  });

  it("filters by kind and status, and feeds the badge and the dashboard", async () => {
    const admin = await adminClient();
    const reports = await admin.get("/api/admin/support?kind=report");
    expect(reports.payload.data.tickets.every((ticket) => ticket.kind === "report")).toBe(true);
    const messages = await admin.get("/api/admin/support?kind=support&status=closed");
    expect(messages.payload.data.tickets.every((ticket) => ticket.kind === "support" && ticket.status === "closed")).toBe(true);
    const all = await admin.get("/api/admin/support");
    expect(all.payload.data.counts.open).toBeGreaterThan(0);

    const me = (await admin.get("/api/admin/me")).payload.data;
    expect(me.openTickets).toBeGreaterThan(0);
    expect((await createClient().get("/api/admin/me")).payload.data.openTickets).toBe(0);
    expect((await admin.get("/api/admin/dashboard")).payload.data.alerts.openTickets).toBe(me.openTickets);
  });
});
