import { describe, it, expect } from "vitest";
import { adminClient, createClient, registerUser } from "./helpers.js";

describe("admin panel API", () => {
  it("refuses everyone who is not an admin", async () => {
    const anon = createClient();
    expect((await anon.get("/api/admin/stats")).status).toBe(403);
    const client = createClient();
    await registerUser(client, { type: "client" });
    expect((await client.get("/api/admin/users")).status).toBe(403);
    const me = await client.get("/api/admin/me");
    expect(me.payload.data.isAdmin).toBe(false);
    expect((await client.post("/api/admin/users/1/suspend", { suspended: true })).status).toBe(403);
  });

  it("shows the overview and finds users by name or phone", async () => {
    const admin = await adminClient();
    expect((await admin.get("/api/admin/me")).payload.data.isAdmin).toBe(true);
    const stats = await admin.get("/api/admin/stats");
    expect(stats.ok).toBe(true);
    expect(stats.payload.data.users.total).toBeGreaterThan(0);
    expect(stats.payload.data.signupsByDay).toHaveLength(14);

    const target = createClient();
    const user = await registerUser(target, { type: "artist", name: "پیدا شونده یکتا" });
    const byName = await admin.get(`/api/admin/users?q=${encodeURIComponent("پیدا شونده یکتا")}`);
    expect(byName.payload.data.users.map((row) => row.phone)).toContain(user.phone);
    const byPhone = await admin.get(`/api/admin/users?q=${user.phone}&type=artist`);
    expect(byPhone.payload.data.total).toBe(1);
  });

  it("suspends an account: sessions die at once, login says so, and it can be lifted", async () => {
    const admin = await adminClient();
    const target = createClient();
    const user = await registerUser(target, { type: "client", name: "مسدودشونده" });
    expect((await target.get("/api/auth/me")).payload.data.user).not.toBeNull();

    const suspended = await admin.post(`/api/admin/users/${user.user.id}/suspend`, { suspended: true });
    expect(suspended.ok).toBe(true);
    expect((await target.get("/api/auth/me")).payload.data.user).toBeNull();

    const blocked = await createClient().post("/api/auth/login", { phone: user.phone, password: "testpass123" });
    expect(blocked.status).toBe(403);
    expect(blocked.payload.code).toBe("suspended");
    expect(blocked.payload.error).toMatch(/[؀-ۿ]/);

    expect((await admin.post(`/api/admin/users/${user.user.id}/suspend`, { suspended: false })).ok).toBe(true);
    expect((await createClient().post("/api/auth/login", { phone: user.phone, password: "testpass123" })).ok).toBe(true);

    const actions = await admin.get("/api/admin/actions");
    expect(actions.payload.data.actions.some((item) => item.action === "suspend" && item.target_user_id === user.user.id)).toBe(true);
  });

  it("never lets an admin be suspended, and 404s on unknown users", async () => {
    const admin = await adminClient();
    const { TEST_ADMIN_PHONE } = await import("../globalSetup.js");
    const adminId = (await admin.get(`/api/admin/users?q=${TEST_ADMIN_PHONE}`)).payload.data.users[0].id;
    expect((await admin.post(`/api/admin/users/${adminId}/suspend`, { suspended: true })).status).toBe(400);
    expect((await admin.post("/api/admin/users/999999999/suspend", { suspended: true })).status).toBe(404);
  });
});
