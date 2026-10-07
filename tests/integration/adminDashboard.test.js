import { describe, it, expect } from "vitest";
import { adminClient, createClient, enrolledAdminClient, registerUser } from "./helpers.js";
import { TEST_ADMIN2_PHONE, TEST_ADMIN4_PHONE, TEST_ADMIN_PASSWORD } from "../globalSetup.js";
import { forecastNext } from "../../app/lib/db/repos/adminDashboard.js";

describe("forecastNext", () => {
  it("projects a rising trend upward, a flat one flat, and never goes below zero", () => {
    expect(forecastNext([1, 2, 3, 4, 5, 6, 7], 7)).toBeGreaterThan(forecastNext([4, 4, 4, 4, 4, 4, 4], 7) - 1);
    expect(forecastNext([4, 4, 4, 4, 4, 4, 4], 7)).toBe(28);
    expect(forecastNext([9, 6, 3, 1, 0, 0, 0], 7)).toBeGreaterThanOrEqual(0);
    expect(forecastNext([5], 7)).toBe(0);
  });
});

describe("admin dashboard", () => {
  it("is closed to non-admins", async () => {
    expect((await createClient().get("/api/admin/dashboard")).status).toBe(403);
    const user = createClient();
    await registerUser(user, { type: "client", name: "Not Admin" });
    expect((await user.get("/api/admin/dashboard")).status).toBe(403);
  });

  it("returns numbers, a series per day, alerts, a forecast and a live activity feed", async () => {
    const admin = await adminClient();
    const fresh = createClient();
    const person = await registerUser(fresh, { type: "artist", name: "داشبورد نمونه" });

    const week = await admin.get("/api/admin/dashboard?days=7");
    expect(week.ok).toBe(true);
    const data = week.payload.data;
    expect(data.days).toBe(7);
    expect(data.series).toHaveLength(7);
    expect(data.totals.users).toBeGreaterThan(0);
    expect(data.kpis.signups.value).toBeGreaterThan(0);
    expect(data.series.reduce((sum, row) => sum + row.signups, 0)).toBe(data.kpis.signups.value);
    expect(data.forecast.signups).toBeGreaterThanOrEqual(0);
    expect(data.forecast.reliable).toBeTypeOf("boolean");
    expect(data.byType.some((row) => row.type === "artist")).toBe(true);
    expect(data.feed.some((item) => item.kind === "signup" && item.title === "داشبورد نمونه")).toBe(true);
    expect(JSON.stringify(data)).not.toContain("password_hash");
    expect(person.user.id).toBeGreaterThan(0);

    expect((await admin.get("/api/admin/dashboard?days=30")).payload.data.series).toHaveLength(30);
    expect((await admin.get("/api/admin/dashboard?days=999")).payload.data.days).toBe(7); // only 7 or 30 are accepted
  });
});

// These tests use their own enrolled admin (admin4) so the 5-minute password re-check never leaks into the shared admin session other files rely on.
describe("resetting another admin's authenticator", () => {
  it("needs the password re-check, never works on yourself or on non-admins", async () => {
    const admin = await enrolledAdminClient(TEST_ADMIN4_PHONE);
    const me = (await admin.get(`/api/admin/users?q=${TEST_ADMIN4_PHONE}`)).payload.data.users[0];
    const probe = await admin.post("/api/admin/security/reset-authenticator", { userId: me.id });
    expect(probe.status).toBe(403);
    expect(probe.payload.code).toBe("stepup_required");
    const other = createClient();
    const plain = await registerUser(other, { type: "client", name: "Plain" });
    const plainId = plain.user.id;

    // Make sure the password re-check is fresh before the guards below.
    expect((await admin.post("/api/admin/auth/stepup", { password: TEST_ADMIN_PASSWORD })).ok).toBe(true);
    expect((await admin.post("/api/admin/security/reset-authenticator", { userId: me.id })).status).toBe(400); // yourself
    expect((await admin.post("/api/admin/security/reset-authenticator", { userId: plainId })).status).toBe(400); // not an admin
    expect((await admin.post("/api/admin/security/reset-authenticator", { userId: 999999999 })).status).toBe(404);
    expect((await admin.post("/api/admin/security/reset-authenticator", {})).status).toBe(400);
    expect((await createClient().post("/api/admin/security/reset-authenticator", { userId: plainId })).status).toBe(403);
  });

  it("lists every configured admin and lets one admin clear another's authenticator so setup can run again", async () => {
    const admin = await enrolledAdminClient(TEST_ADMIN4_PHONE);
    const accounts = (await admin.get("/api/admin/security")).payload.data.accounts;
    expect(accounts.some((account) => account.phone === TEST_ADMIN4_PHONE && account.authenticator)).toBe(true);
    expect(accounts.every((account) => typeof account.registered === "boolean")).toBe(true);

    // The second admin may not be registered yet when this file runs alone.
    await registerUser(createClient(), { type: "client", name: "Admin Two", phone: TEST_ADMIN2_PHONE }).catch(() => null);
    const second = (await admin.get(`/api/admin/users?q=${TEST_ADMIN2_PHONE}`)).payload.data.users[0];
    expect(second).toBeTruthy();
    expect((await admin.post("/api/admin/auth/stepup", { password: TEST_ADMIN_PASSWORD })).ok).toBe(true);
    expect((await admin.post("/api/admin/security/reset-authenticator", { userId: second.id })).ok).toBe(true);
    const after = (await admin.get("/api/admin/security")).payload.data.accounts.find((account) => account.phone === TEST_ADMIN2_PHONE);
    expect(after.authenticator).toBe(false);
  });
});
