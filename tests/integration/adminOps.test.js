import { describe, it, expect } from "vitest";
import { adminClient, createClient, registerUser, futureBookingDay } from "./helpers.js";
import { TEST_ADMIN_PASSWORD } from "../globalSetup.js";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("admin panel: users, content, bookings, security", () => {
  it("shuts every new endpoint to non-admins", async () => {
    const anon = createClient();
    const user = createClient();
    const target = await registerUser(user, { type: "client", name: "Normal" });
    for (const path of ["/api/admin/posts", "/api/admin/bookings", "/api/admin/security", `/api/admin/users/${target.user.id}`]) {
      expect((await anon.get(path)).status).toBe(403);
      expect((await user.get(path)).status).toBe(403);
    }
    expect((await user.post("/api/admin/auth/stepup", { password: "testpass123" })).status).toBe(401);
    expect((await user.post(`/api/admin/users/${target.user.id}/logout`, {})).status).toBe(403);
    expect((await user.post("/api/admin/security/revoke", { userId: 1 })).status).toBe(403);
  });

  it("shows an account's detail and can sign it out everywhere", async () => {
    const admin = await adminClient();
    const target = createClient();
    const user = await registerUser(target, { type: "artist", name: "Detail Target" });
    const detail = await admin.get(`/api/admin/users/${user.user.id}`);
    expect(detail.ok).toBe(true);
    expect(detail.payload.data.user.phone).toBe(user.phone);
    expect(detail.payload.data.user.password_hash).toBeUndefined();
    expect(detail.payload.data.activeSessions).toBeGreaterThan(0);
    expect((await admin.get("/api/admin/users/999999999")).status).toBe(404);

    expect((await target.get("/api/auth/me")).payload.data.user).not.toBeNull();
    expect((await admin.post(`/api/admin/users/${user.user.id}/logout`, {})).ok).toBe(true);
    expect((await target.get("/api/auth/me")).payload.data.user).toBeNull();
  });

  it("moderates posts: hide/show freely, delete only after a password re-check", async () => {
    const admin = await adminClient();
    const artist = createClient();
    await registerUser(artist, { type: "artist", name: "Moderated Artist" });
    const created = await artist.post("/api/posts", { title: "پست قابل بررسی", tag: "ناخن", caption: "x", image: PNG });
    const postId = created.payload.data.post.id;

    const found = await admin.get(`/api/admin/posts?q=${encodeURIComponent("پست قابل بررسی")}`);
    expect(found.payload.data.posts.map((post) => post.id)).toContain(postId);

    expect((await admin.post(`/api/admin/posts/${postId}`, { action: "hide" })).ok).toBe(true);
    const hidden = await admin.get(`/api/admin/posts?visibility=hidden&q=${encodeURIComponent("پست قابل بررسی")}`);
    expect(hidden.payload.data.total).toBe(1);
    expect((await admin.post(`/api/admin/posts/${postId}`, { action: "show" })).ok).toBe(true);
    expect((await admin.post(`/api/admin/posts/${postId}`, { action: "nonsense" })).status).toBe(400);

    // Delete is a dangerous action: refused until the password is re-typed.
    const refused = await admin.post(`/api/admin/posts/${postId}`, { action: "delete" });
    expect(refused.status).toBe(403);
    expect(refused.payload.code).toBe("stepup_required");
    expect((await admin.post("/api/admin/auth/stepup", { password: "wrong-password" })).status).toBe(401);
    expect((await admin.post("/api/admin/auth/stepup", { password: TEST_ADMIN_PASSWORD })).ok).toBe(true);
    expect((await admin.post(`/api/admin/posts/${postId}`, { action: "delete" })).ok).toBe(true);
    expect((await admin.post(`/api/admin/posts/${postId}`, { action: "delete" })).status).toBe(404);
  });

  it("deletes an account only with the password re-check and the phone typed back; never an admin", async () => {
    const admin = await adminClient();
    await admin.post("/api/admin/auth/stepup", { password: TEST_ADMIN_PASSWORD });
    const target = createClient();
    const user = await registerUser(target, { type: "client", name: "To Delete" });

    const wrong = await admin.delete(`/api/admin/users/${user.user.id}`, { confirmPhone: "09000000000" });
    expect(wrong.status).toBe(400);
    expect((await admin.get(`/api/admin/users/${user.user.id}`)).ok).toBe(true);
    const gone = await admin.delete(`/api/admin/users/${user.user.id}`, { confirmPhone: user.phone });
    expect(gone.ok).toBe(true);
    expect((await admin.get(`/api/admin/users/${user.user.id}`)).status).toBe(404);

    const { TEST_ADMIN_PHONE } = await import("../globalSetup.js");
    const adminRow = (await admin.get(`/api/admin/users?q=${TEST_ADMIN_PHONE}`)).payload.data.users[0];
    expect((await admin.delete(`/api/admin/users/${adminRow.id}`, { confirmPhone: TEST_ADMIN_PHONE })).status).toBe(400);
  });

  it("lists bookings across salons and artists, filterable by status and text", async () => {
    const admin = await adminClient();
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", name: "Admin View Salon" });
    await salonClient.get("/api/salon-hours");
    const bookerClient = createClient();
    const booker = await registerUser(bookerClient, { type: "client", name: "Admin View Booker" });
    const booked = await bookerClient.post("/api/salon-bookings", { salonUserId: salon.user.id, service: "رنگ مو", bookingDate: futureBookingDay(2), time: "۱۰:۰۰", client: booker.user.name, phone: booker.phone });
    expect(booked.ok).toBe(true);

    const result = await admin.get(`/api/admin/bookings?q=${encodeURIComponent("Admin View Salon")}`);
    expect(result.ok).toBe(true);
    expect(result.payload.data.bookings.some((row) => row.client === "Admin View Booker" && row.kind === "salon")).toBe(true);
    expect(result.payload.data.statuses.length).toBeGreaterThan(0);
    const status = booked.payload.data.booking.status;
    const filtered = await admin.get(`/api/admin/bookings?status=${encodeURIComponent(status)}&q=${booker.phone}`);
    expect(filtered.payload.data.total).toBe(1);
  });

  it("shows live admin sessions and sign-in events without tokens", async () => {
    const admin = await adminClient();
    const security = await admin.get("/api/admin/security");
    expect(security.ok).toBe(true);
    expect(security.payload.data.sessions.length).toBeGreaterThan(0);
    expect(JSON.stringify(security.payload)).not.toMatch(/token/i);
    expect(security.payload.data.events.some((event) => event.action === "enroll")).toBe(true);
  });
});
