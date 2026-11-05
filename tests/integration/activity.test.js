import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { adminClient, createClient, registerUser, uniquePhone } from "./helpers.js";
import { q } from "./angle2Util.js";

const batch = (visitor, visit, events = [], extra = {}) => ({ visitor, visit, events, ...extra });
const screen = (n, p) => ({ k: "screen", n, ago: 1000, ...(p ? { p } : {}) });
const action = (n, p) => ({ k: "action", n, ago: 500, ...(p ? { p } : {}) });

describe("the footprint", () => {
  it("records a visitor without an account, and a bad batch records nothing", async () => {
    const guest = createClient();
    const [visitor, visit] = [randomUUID(), randomUUID()];
    const res = await guest.post("/api/activity", batch(visitor, visit, [screen("tab:profile")], { source: "instagram.com" }));
    expect(res.status).toBe(204);
    const [row] = await q("SELECT user_id, source, device FROM activity_visits WHERE id = $1", [visit]);
    expect(row).toMatchObject({ user_id: null, source: "instagram.com" });

    const typed = await guest.post("/api/activity", batch(visitor, randomUUID(), [{ k: "action", n: "رمز من ۱۲۳", ago: 0 }]));
    expect(typed.status).toBe(400);
    const tooMany = await guest.post("/api/activity", batch(visitor, randomUUID(), Array.from({ length: 41 }, () => screen("tab:profile"))));
    expect(tooMany.status).toBe(400);
  });

  it("takes the account from the session, joins earlier visits of that phone, and fills last seen", async () => {
    const person = createClient();
    const [visitor, before, after] = [randomUUID(), randomUUID(), randomUUID()];
    await person.post("/api/activity", batch(visitor, before, [screen("public_salon")]));
    const { user } = await registerUser(person, { type: "client", name: "رد پای تازه" });
    const other = createClient();
    const { user: victim } = await registerUser(other, { type: "client", name: "رد پای دیگری" });

    await person.post("/api/activity", { ...batch(visitor, after, [action("register")]), userId: victim.id, user_id: victim.id });

    const rows = await q("SELECT id, user_id FROM activity_visits WHERE visitor_id = $1", [visitor]);
    expect(rows.map((row) => row.user_id)).toEqual([user.id, user.id]);
    const [seen] = await q("SELECT last_seen_at FROM users WHERE id = $1", [user.id]);
    expect(seen.last_seen_at).not.toBe(null);
  });

  it("refuses a big body, and one account cannot take over another's visit", async () => {
    const res = await createClient().post("/api/activity", batch(randomUUID(), randomUUID(), [], { source: "a", pad: "x".repeat(20000) }));
    expect(res.status).toBe(400);

    const first = createClient();
    const { user } = await registerUser(first, { type: "client", name: "صاحب بازدید" });
    const second = createClient();
    await registerUser(second, { type: "client", name: "نفر بعدی" });
    const [visitor, visit] = [randomUUID(), randomUUID()];
    await first.post("/api/activity", batch(visitor, visit, [screen("tab:profile")]));
    await second.post("/api/activity", batch(visitor, visit, [screen("tab:settings")]));
    expect((await q("SELECT user_id FROM activity_visits WHERE id = $1", [visit]))[0].user_id).toBe(user.id);
    expect(await q("SELECT name FROM activity_events WHERE visit_id = $1", [visit])).toEqual([{ name: "tab:profile" }]);
  });

  it("ignores a visit id that belongs to another phone", async () => {
    const [visitor, visit] = [randomUUID(), randomUUID()];
    await createClient().post("/api/activity", batch(visitor, visit, [screen("tab:profile")]));
    await createClient().post("/api/activity", batch(randomUUID(), visit, [screen("tab:settings")]));
    expect(await q("SELECT name FROM activity_events WHERE visit_id = $1", [visit])).toEqual([{ name: "tab:profile" }]);
  });

  it("counts visitors on a public page, not its owner, and survives an unknown profile", async () => {
    const owner = createClient();
    const { user: artist } = await registerUser(owner, { type: "artist", name: `رد پا ${Date.now()}` });
    await owner.post("/api/activity", batch(randomUUID(), randomUUID(), [screen("public_artist", artist.id)]));
    const visitor = randomUUID();
    await createClient().post("/api/activity", batch(visitor, randomUUID(), [screen("public_artist", artist.id), action("book_tap", artist.id), screen("public_artist", 2147483000)]));

    const admin = await adminClient();
    const { page, visits, totals } = (await admin.get(`/api/admin/users/${artist.id}/footprint`)).payload.data;
    expect(page).toMatchObject({ viewers: 1, book_taps: 1 });
    expect(totals.visits).toBe(1);
    expect(visits[0].events).toEqual([]);
  });

  it("shows a person's visits to the admin only", async () => {
    const person = createClient();
    const { user } = await registerUser(person, { type: "salon", name: `رد پا سالن ${Date.now()}` });
    const visit = randomUUID();
    await person.post("/api/activity", batch(randomUUID(), visit, [screen("rail:hours"), action("add_service")]));

    expect((await person.get(`/api/admin/users/${user.id}/footprint`)).status).toBe(403);
    expect((await person.get("/api/admin/activity")).status).toBe(403);

    const admin = await adminClient();
    const { visits } = (await admin.get(`/api/admin/users/${user.id}/footprint`)).payload.data;
    expect(visits[0].id).toBe(visit);
    expect(visits[0].events.map((event) => event.name)).toEqual(["rail:hours", "add_service"]);
    const report = (await admin.get("/api/admin/activity?days=7")).payload.data;
    expect(report.summary.visits).toBeGreaterThan(0);
    expect(report.funnels.find((row) => row.type === "salon").signed).toBeGreaterThan(0);
  });

  it("leaves the test accounts out of the report", async () => {
    const tester = createClient();
    await registerUser(tester, { type: "client", name: "حساب تست", phone: process.env.TEST_FOOTPRINT_PHONE || "09129990001" });
    await tester.post("/api/activity", batch(randomUUID(), randomUUID(), [screen("page:only-test-account")]));
    const admin = await adminClient();
    const { lastScreens } = (await admin.get("/api/admin/activity?days=7")).payload.data;
    expect(lastScreens.map((row) => row.name)).not.toContain("page:only-test-account");
  });

  it("keeps the numbers but no person after an account is deleted", async () => {
    const admin = await adminClient();
    const person = createClient();
    const phone = uniquePhone();
    const { user } = await registerUser(person, { type: "client", name: "رد پای پاک‌شونده", phone });
    const [visitor, visit] = [randomUUID(), randomUUID()];
    await person.post("/api/activity", batch(visitor, visit, [screen("tab:profile")]));
    expect((await person.delete("/api/profile", { currentPassword: "testpass123", cancelAll: true })).ok).toBe(true);

    const [row] = await q("SELECT user_id, visitor_id FROM activity_visits WHERE id = $1", [visit]);
    expect(row).toEqual({ user_id: null, visitor_id: "gone" });

    // A new account on the same phone cannot claim the old visit.
    const again = createClient();
    const { user: next } = await registerUser(again, { type: "client", name: "حساب تازه" });
    await again.post("/api/activity", batch(visitor, randomUUID(), []));
    expect((await q("SELECT user_id FROM activity_visits WHERE id = $1", [visit]))[0].user_id).toBe(null);
    expect((await admin.get(`/api/admin/users/${next.id}/footprint`)).payload.data.totals.visits).toBe(1);
  });
});
