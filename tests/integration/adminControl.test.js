import { describe, it, expect } from "vitest";
import { adminClient, createClient, enrolledAdminClient, futureBookingDay, registerUser, uniquePhone } from "./helpers.js";
import { TEST_ADMIN_PHONE, TEST_ADMIN6_PHONE, TEST_ADMIN_PASSWORD } from "../globalSetup.js";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const NOTICE = { enabled: true, text: "اعلان آزمایشی برای همه", tone: "info", audience: "all", link: "", linkLabel: "" };
const SIGNUPS_OPEN = { client: true, artist: true, salon: true, message: "" };

describe("admin control room: settings, broadcast, health, reports, bulk actions", () => {
  it("keeps every new endpoint shut to non-admins", async () => {
    const user = createClient();
    await registerUser(user, { type: "client", name: "Not Admin" });
    for (const path of ["/api/admin/settings", "/api/admin/broadcast", "/api/admin/system", "/api/admin/reports", "/api/admin/export?kind=users", "/api/admin/bookings/salon/1"]) {
      expect((await createClient().get(path)).status).toBe(403);
      expect((await user.get(path)).status).toBe(403);
    }
    expect((await user.post("/api/admin/users/bulk", { ids: [1], action: "suspend" })).status).toBe(403);
    expect((await user.post("/api/admin/posts/bulk", { ids: [1], action: "hide" })).status).toBe(403);
    expect((await user.post("/api/admin/broadcast", { segment: "all", channels: ["inbox"], body: "سلام" })).status).toBe(403);
    expect((await fetchPut(user, { key: "notice", value: NOTICE })).status).toBe(403);
  });

  it("turns the site notice on and off, and validates it", async () => {
    const admin = await adminClient();
    const put = (value) => fetchPut(admin, { key: "notice", value });
    expect((await put({ ...NOTICE, text: "" })).status).toBe(400);
    expect((await put({ ...NOTICE, link: "javascript:alert(1)" })).status).toBe(400);
    expect((await put(NOTICE)).ok).toBe(true);
    const shown = await createClient().get("/api/notice");
    expect(shown.payload.data.notice.text).toBe(NOTICE.text);
    expect(shown.payload.data.notice.id).toBeGreaterThan(0);

    expect((await put({ ...NOTICE, enabled: false })).ok).toBe(true);
    expect((await createClient().get("/api/notice")).payload.data.notice).toBeNull();
    const settings = (await admin.get("/api/admin/settings")).payload.data;
    expect(settings.notice.enabled).toBe(false);
    expect(settings.signups.client).toBe(true);
    expect(settings.notice.updatedBy).toBe(TEST_ADMIN_PHONE);
  });

  it("pauses sign-ups for one role only, with the admin's message", async () => {
    const admin = await adminClient();
    expect((await fetchPut(admin, { key: "signups", value: { ...SIGNUPS_OPEN, salon: false, message: "ثبت سالن تا هفتهٔ بعد بسته است." } })).ok).toBe(true);
    try {
      const salon = await createClient().post("/api/auth/register", { phone: uniquePhone(), password: "testpass123", type: "salon", name: "Closed Salon" });
      expect(salon.status).toBe(403);
      expect(salon.payload.code).toBe("signups_closed");
      expect(salon.payload.error).toBe("ثبت سالن تا هفتهٔ بعد بسته است.");
      await registerUser(createClient(), { type: "client", name: "Still Open" });
    } finally {
      expect((await fetchPut(admin, { key: "signups", value: SIGNUPS_OPEN })).ok).toBe(true);
    }
    await registerUser(createClient(), { type: "salon", name: "Open Again Salon" });
  });

  it("saves canned support replies", async () => {
    const admin = await adminClient();
    const items = [{ id: "r1", title: "سلام", body: "سلام، ممنون از پیامت. بررسی می‌کنیم." }];
    expect((await fetchPut(admin, { key: "replies", value: { items } })).ok).toBe(true);
    expect((await admin.get("/api/admin/settings")).payload.data.replies.items).toEqual(items);
    expect((await fetchPut(admin, { key: "replies", value: { items: [{ id: "x", title: "", body: "" }] } })).status).toBe(400);
    expect((await fetchPut(admin, { key: "nonsense", value: {} })).status).toBe(400);
  });

  it("broadcasts to a segment only after a password re-check, and refuses a double send", async () => {
    const admin = await enrolledAdminClient(TEST_ADMIN6_PHONE);
    const salonClient = createClient();
    await registerUser(salonClient, { type: "salon", name: "Broadcast Salon" });

    const reach = await admin.get("/api/admin/broadcast?segment=incomplete");
    expect(reach.payload.data.reach.recipients).toBeGreaterThan(0);

    const message = { segment: "incomplete", channels: ["inbox", "push"], title: "یادآوری", body: `خدمت‌هایت را اضافه کن ${Date.now()}` };
    const refused = await admin.post("/api/admin/broadcast", message);
    expect(refused.status).toBe(403);
    expect(refused.payload.code).toBe("stepup_required");
    expect((await admin.post("/api/admin/auth/stepup", { password: TEST_ADMIN_PASSWORD })).ok).toBe(true);

    expect((await admin.post("/api/admin/broadcast", { ...message, channels: [] })).status).toBe(400);
    expect((await admin.post("/api/admin/broadcast", { ...message, segment: "everyone" })).status).toBe(400);
    expect((await admin.post("/api/admin/broadcast", { ...message, url: "https://evil.example" })).status).toBe(400);

    const sent = await admin.post("/api/admin/broadcast", message);
    expect(sent.status).toBe(201);
    expect(sent.payload.data.broadcast.inboxed).toBeGreaterThan(0);
    expect(sent.payload.data.broadcast.recipients).toBe(sent.payload.data.broadcast.inboxed);
    expect((await admin.post("/api/admin/broadcast", message)).status).toBe(409);

    // It lands, unread, in the salon's own support center, and does not crowd the admin's open inbox.
    const tickets = (await salonClient.get("/api/support/tickets")).payload.data.tickets;
    const mine = tickets.find((ticket) => ticket.subject === "یادآوری");
    expect(mine.unread).toBe(true);
    expect(mine.last_body).toBe(message.body);
    expect((await admin.get("/api/admin/support?awaiting=user&q=" + encodeURIComponent(message.body))).payload.data.total).toBe(0);
    expect((await admin.get("/api/admin/broadcast")).payload.data.history[0].body).toBe(message.body);
  });

  it("sends a broadcast once even when it is posted twice at the same moment", async () => {
    const admin = await enrolledAdminClient(TEST_ADMIN6_PHONE);
    expect((await admin.post("/api/admin/auth/stepup", { password: TEST_ADMIN_PASSWORD })).ok).toBe(true);
    const message = { segment: "all", channels: ["inbox"], title: "دوبار", body: `دو کلیک هم‌زمان ${Date.now()}` };
    const statuses = (await Promise.all([admin.post("/api/admin/broadcast", message), admin.post("/api/admin/broadcast", message)])).map((res) => res.status).sort();
    expect(statuses).toEqual([201, 409]);
    const history = (await admin.get("/api/admin/broadcast")).payload.data.history.filter((row) => row.body === message.body);
    expect(history).toHaveLength(1);
    expect(history[0].inboxed).toBeGreaterThan(0);
  });

  it("filters users by status, sorts them, and runs bulk actions that never touch an admin", async () => {
    const admin = await adminClient();
    const a = await registerUser(createClient(), { type: "client", name: "Bulk A" });
    const bClient = createClient();
    const b = await registerUser(bClient, { type: "client", name: "Bulk B" });
    const me = (await admin.get(`/api/admin/users?q=${TEST_ADMIN_PHONE}`)).payload.data.users[0];

    const listed = await admin.get("/api/admin/users?status=new&sort=name&q=Bulk");
    expect(listed.ok).toBe(true);
    expect(listed.payload.data.counts.new).toBeGreaterThanOrEqual(2);

    const suspended = await admin.post("/api/admin/users/bulk", { ids: [a.user.id, b.user.id, me.id], action: "suspend", reason: "اسپم" });
    expect(suspended.payload.data).toEqual({ changed: 2, skipped: 1 });
    expect((await bClient.get("/api/auth/me")).payload.data.user).toBeNull();
    expect((await admin.get("/api/admin/users?status=suspended&q=Bulk")).payload.data.users.map((user) => user.id)).toEqual(expect.arrayContaining([a.user.id, b.user.id]));
    expect((await admin.get(`/api/admin/users/${me.id}`)).payload.data.user.suspended_at).toBeNull();

    const log = (await admin.get(`/api/admin/actions?group=accounts&user=${a.user.id}`)).payload.data;
    expect(log.actions[0].action).toBe("suspend");
    expect(log.actions[0].detail).toContain("اسپم");
    expect((await admin.post("/api/admin/users/bulk", { ids: [a.user.id, b.user.id], action: "unsuspend" })).payload.data.changed).toBe(2);
    expect((await admin.post("/api/admin/users/bulk", { ids: [a.user.id], action: "explode" })).status).toBe(400);

    const detail = (await admin.get(`/api/admin/users/${a.user.id}`)).payload.data;
    expect(detail.history.map((row) => row.action)).toEqual(expect.arrayContaining(["suspend", "unsuspend"]));
    expect(detail.pushDevices).toBe(0);
  });

  it("hides posts in bulk and still shows the admin their picture", async () => {
    const admin = await adminClient();
    const artist = createClient();
    await registerUser(artist, { type: "artist", name: "Bulk Post Artist" });
    const ids = [];
    for (const title of ["پست گروهی یک", "پست گروهی دو"]) ids.push((await artist.post("/api/posts", { title, tag: "ناخن", caption: "x", image: PNG })).payload.data.post.id);
    expect((await admin.post("/api/admin/posts/bulk", { ids, action: "hide" })).payload.data.changed).toBe(2);
    const hidden = await admin.get(`/api/admin/posts?visibility=hidden&q=${encodeURIComponent("پست گروهی")}`);
    expect(hidden.payload.data.total).toBe(2);
    expect(hidden.payload.data.posts[0].has_image).toBe(true);

    const res = await fetch(`${process.env.TEST_BASE_URL}/api/admin/posts/${ids[0]}/image`, { headers: { Cookie: admin.cookie() } });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect((await fetch(`${process.env.TEST_BASE_URL}/api/admin/posts/${ids[0]}/image`)).status).toBe(403);
    expect((await admin.post("/api/admin/posts/bulk", { ids, action: "show" })).payload.data.changed).toBe(2);
  });

  it("opens one booking with both people and cancels it with a reason", async () => {
    const admin = await adminClient();
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", name: "Cancel Test Salon" });
    await salonClient.get("/api/salon-hours");
    const bookerClient = createClient();
    const booker = await registerUser(bookerClient, { type: "client", name: "Cancel Test Booker" });
    const booked = await bookerClient.post("/api/salon-bookings", { salonUserId: salon.user.id, service: "کوتاهی مو", bookingDate: futureBookingDay(3), time: "۱۱:۰۰", client: booker.user.name, phone: booker.phone });
    expect(booked.ok).toBe(true);
    const id = booked.payload.data.booking.id;

    const upcoming = await admin.get(`/api/admin/bookings?when=upcoming&kind=salon&q=${booker.phone}`);
    expect(upcoming.payload.data.total).toBe(1);
    expect((await admin.get(`/api/admin/bookings?when=past&q=${booker.phone}`)).payload.data.total).toBe(0);

    const detail = (await admin.get(`/api/admin/bookings/salon/${id}`)).payload.data;
    expect(detail.provider.id).toBe(salon.user.id);
    expect(detail.client.id).toBe(booker.user.id);
    expect(detail.cancellable).toBe(true);
    expect((await admin.get("/api/admin/bookings/nope/1")).status).toBe(404);

    expect((await admin.post(`/api/admin/bookings/salon/${id}`, { action: "cancel", reason: "" })).status).toBe(400);
    expect((await admin.post(`/api/admin/bookings/salon/${id}`, { action: "cancel", reason: "درخواست جعلی" })).ok).toBe(true);
    const after = (await admin.get(`/api/admin/bookings/salon/${id}`)).payload.data;
    expect(after.booking.status).toBe("لغو");
    expect(after.cancellable).toBe(false);
    expect(after.history[0].detail).toContain("درخواست جعلی");
    expect((await admin.post(`/api/admin/bookings/salon/${id}`, { action: "cancel", reason: "دوباره" })).status).toBe(409);
  });

  it("reports health without secrets, keeps browser crashes, and cleans up", async () => {
    const admin = await adminClient();
    const marker = `TypeError: admin health check ${Date.now()}`;
    expect((await createClient().post("/api/client-errors", { message: marker, source: "test", url: "/x" })).ok).toBe(true);

    const system = await admin.get("/api/admin/system");
    expect(system.ok).toBe(true);
    const { config, health, errors } = system.payload.data;
    expect(config.adminSecret).toBe(true);
    expect(config.sms).toBe("test");
    expect(config.adminPhones).toBeGreaterThan(0);
    expect(health.db.latencyMs).toBeGreaterThanOrEqual(0);
    expect(health.tables.find((table) => table.name === "users").rows).toBeGreaterThan(0);
    expect(errors.groups.some((group) => group.message === marker)).toBe(true);
    const text = JSON.stringify(system.payload);
    expect(text).not.toContain("test-admin-secret");
    expect(text).not.toContain("test-admin-setup-key");

    expect((await admin.post("/api/admin/system", { action: "cleanup" })).ok).toBe(true);
    expect((await admin.post("/api/admin/system", { action: "nope" })).status).toBe(400);
  });

  it("builds the reports page", async () => {
    const admin = await adminClient();
    const reports = await admin.get("/api/admin/reports?days=90");
    expect(reports.ok).toBe(true);
    const data = reports.payload.data;
    expect(data.days).toBe(90);
    expect(Array.isArray(data.providers)).toBe(true);
    expect(data.readiness.pros).toBeGreaterThan(0);
    expect(data.activity.total).toBeGreaterThan(0);
    expect(data.funnel.clients).toBeGreaterThanOrEqual(data.funnel.booked);
  });

  it("exports rows only after a password re-check, and logs it", async () => {
    const admin = await enrolledAdminClient(TEST_ADMIN6_PHONE);
    await admin.post("/api/admin/auth/stepup", { password: TEST_ADMIN_PASSWORD });
    const users = await admin.get("/api/admin/export?kind=users");
    expect(users.ok).toBe(true);
    expect(users.payload.data.rows.length).toBeGreaterThan(0);
    expect(users.payload.data.rows[0].password_hash).toBeUndefined();
    expect((await admin.get("/api/admin/export?kind=passwords")).status).toBe(400);
    const log = (await admin.get("/api/admin/actions?group=system")).payload.data.actions;
    expect(log.some((row) => row.action === "export")).toBe(true);

    const fresh = await adminClient();
    const stale = await fresh.get("/api/admin/export?kind=users");
    if (!stale.ok) expect(stale.payload.code).toBe("stepup_required");
  });
});

/** PUT with the admin cookie (the tiny test client has no put helper). */
async function fetchPut(client, body) {
  const res = await fetch(`${process.env.TEST_BASE_URL}/api/admin/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: client.cookie() },
    body: JSON.stringify(body)
  });
  return { status: res.status, ok: res.ok, payload: await res.json().catch(() => ({})) };
}
