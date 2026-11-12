import { describe, it, expect } from "vitest";
import pg from "pg";
import { createClient, enrolledAdminClient, futureBookingDay, joinSalonAsArtist, registerUser } from "./helpers.js";
import { TEST_ADMIN7_PHONE, TEST_ADMIN_PASSWORD } from "../globalSetup.js";

/**
 * The admin's «تبدیل به آرتیست» (owner 2026-11-12: an artist signed up as a salon by mistake). Every case the owner
 * named: the name must not clash with another salon or artist, and nothing is lost or half-done.
 */
const tag = () => String(Math.floor(Math.random() * 1e8));

async function sql(text, params = []) {
  const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
  await db.connect();
  try { return (await db.query(text, params)).rows; } finally { await db.end(); }
}

async function steppedAdmin() {
  const admin = await enrolledAdminClient(TEST_ADMIN7_PHONE);
  expect((await admin.post("/api/admin/auth/stepup", { password: TEST_ADMIN_PASSWORD })).ok).toBe(true);
  return admin;
}

async function newSalon(prefix = "سالن اشتباهی") {
  const api = createClient();
  const account = await registerUser(api, { type: "salon", name: `${prefix} ${tag()}`, menu: [["کاشت ناخن", "90 دقیقه"], ["مانیکور", "45 دقیقه"]] });
  await api.get("/api/salon-hours");
  return { api, ...account };
}

describe("admin turns a salon into an artist", () => {
  it("keeps the account, its services, hours, نمونه‌کار and clients; the person signs in again as an artist", async () => {
    const admin = await steppedAdmin();
    const salon = await newSalon();
    const id = salon.user.id;
    // A client connected, one نمونه‌کار, Friday opened with its own hours.
    const client = createClient();
    await registerUser(client, { type: "client", name: "مشتری وصل" });
    expect((await client.post("/api/follows", { targetUserId: id, follow: true })).ok).toBe(true);
    const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    expect((await salon.api.post("/api/posts", { title: "کار من", tag: "ناخن", caption: "x", image: PNG })).ok).toBe(true);
    await sql("UPDATE salon_hours SET open_time = '۱۲:۰۰', close_time = '۱۶:۰۰', active = true WHERE salon_user_id = $1 AND day = 'جمعه'", [id]);

    const preview = await admin.get(`/api/admin/users/${id}/type`);
    expect(preview.payload.data).toMatchObject({ ok: true, services: 2, posts: 1, clients: 1 });

    const done = await admin.post(`/api/admin/users/${id}/type`, { to: "artist" });
    expect(done.ok).toBe(true);
    expect(done.payload.data.services).toBe(2);

    // Signed out of the old salon screens.
    expect((await salon.api.get("/api/auth/me")).payload.data.user).toBeNull();
    // Same phone and password, now an artist with the same name.
    const again = createClient();
    const login = await again.post("/api/auth/login", { phone: salon.phone, password: salon.password });
    expect(login.ok).toBe(true);
    expect(login.payload.data.user).toMatchObject({ id, type: "artist", name: salon.user.name });

    const me = (await again.get("/api/artist/me")).payload.data;
    expect(me.services.map((service) => service.name).sort()).toEqual(["کاشت ناخن", "مانیکور"].sort());
    const friday = (await again.get("/api/artist-hours")).payload.data.hours.find((hour) => hour.day === "جمعه");
    expect(friday).toMatchObject({ open_time: "۱۲:۰۰", close_time: "۱۶:۰۰" });
    expect(Boolean(friday.active)).toBe(true);

    // Nothing of the salon is left behind; the client is still connected; the نمونه‌کار is still there.
    const [left] = await sql(`SELECT (SELECT COUNT(*) FROM salons WHERE user_id = $1)::int AS salons,
      (SELECT COUNT(*) FROM salon_services WHERE salon_user_id = $1)::int AS services,
      (SELECT COUNT(*) FROM salon_hours WHERE salon_user_id = $1)::int AS hours,
      (SELECT COUNT(*) FROM salon_staff WHERE salon_user_id = $1)::int AS staff,
      (SELECT COUNT(*) FROM follows WHERE target_user_id = $1)::int AS clients,
      (SELECT COUNT(*) FROM posts WHERE owner_user_id = $1)::int AS posts`, [id]);
    expect(left).toEqual({ salons: 0, services: 0, hours: 0, staff: 0, clients: 1, posts: 1 });

    // The public artist page opens, and the old salon link (a printed QR code) leads there.
    expect((await createClient().get(`/api/artists/${id}`)).ok).toBe(true);
    const { TEST_BASE_URL } = await import("../globalSetup.js");
    const oldLink = await fetch(`${TEST_BASE_URL}/salons/${id}`, { redirect: "manual" });
    // The page streams (it has a loading skeleton), so Next sends the move inside the page instead of a 307.
    const moved = oldLink.status === 200
      ? (await oldLink.text()).match(/__next-page-redirect[^>]*url=([^"]+)"/)?.[1]
      : oldLink.headers.get("location");
    expect(moved).toContain(`/artists/${id}`);

    // The connected client books the new artist like any artist.
    const booked = await client.post("/api/artist/bookings", { artistUserId: id, service: "مانیکور", bookingDate: futureBookingDay(2), time: "11:00" });
    expect(booked.status).toBe(201);
    // And a booking for the old salon is refused: it is no longer a salon.
    const asSalon = await client.post("/api/salon-bookings", { salonUserId: id, service: "مانیکور", bookingDate: futureBookingDay(3), time: "11:00" });
    expect(asSalon.ok).toBe(false);

    // A second tap does nothing: it is not a salon any more.
    const twice = await admin.post(`/api/admin/users/${id}/type`, { to: "artist" });
    expect(twice.status).toBe(409);
    expect(twice.payload.code).toBe("not_salon");

    const history = (await admin.get(`/api/admin/users/${id}`)).payload.data.history;
    expect(history.some((row) => row.action === "salon_to_artist")).toBe(true);
  });

  it("refuses while another salon or artist holds the same name, and changes nothing", async () => {
    const admin = await steppedAdmin();
    const salon = await newSalon("سالن همنام");
    const other = createClient();
    const artist = await registerUser(other, { type: "artist", name: `آرتیست ${tag()}` });
    // A duplicate from before the one-name rule: written straight into the database.
    await sql("UPDATE users SET name = $1 WHERE id = $2", [`${salon.user.name}!`, artist.user.id]);

    expect((await admin.get(`/api/admin/users/${salon.user.id}/type`)).payload.data).toMatchObject({ ok: false, code: "name_taken" });
    const refused = await admin.post(`/api/admin/users/${salon.user.id}/type`, { to: "artist" });
    expect(refused.status).toBe(409);
    expect(refused.payload.code).toBe("name_taken");
    const [row] = await sql("SELECT type FROM users WHERE id = $1", [salon.user.id]);
    expect(row.type).toBe("salon");
    expect((await salon.api.get("/api/auth/me")).payload.data.user.type).toBe("salon");

    // Once the admin renames the account, it goes through.
    expect((await admin.patch(`/api/admin/users/${salon.user.id}`, { name: `اسم تازه ${tag()}` })).ok).toBe(true);
    expect((await admin.post(`/api/admin/users/${salon.user.id}/type`, { to: "artist" })).ok).toBe(true);
  });

  it("refuses while a booking is still ahead", async () => {
    const admin = await steppedAdmin();
    const salon = await newSalon("سالن با نوبت");
    const client = createClient();
    const who = await registerUser(client, { type: "client", name: "مشتری نوبت" });
    const booked = await client.post("/api/salon-bookings", {
      salonUserId: salon.user.id, service: "مانیکور", bookingDate: futureBookingDay(2), time: "11:00", client: who.user.name, phone: who.phone
    });
    expect(booked.status).toBe(201);

    const refused = await admin.post(`/api/admin/users/${salon.user.id}/type`, { to: "artist" });
    expect(refused.status).toBe(409);
    expect(refused.payload).toMatchObject({ code: "live_bookings", count: 1 });
    const [row] = await sql("SELECT type, (SELECT COUNT(*)::int FROM salon_services WHERE salon_user_id = $1) AS services FROM users WHERE id = $1", [salon.user.id]);
    expect(row).toEqual({ type: "salon", services: 2 });

    // Cancelled, it is history and no longer holds the change back.
    expect((await salon.api.patch("/api/salon-bookings", { id: booked.payload.data.booking.id, status: "لغو" })).ok).toBe(true);
    expect((await admin.post(`/api/admin/users/${salon.user.id}/type`, { to: "artist" })).ok).toBe(true);
  });

  it("refuses while an artist with an account is on the team", async () => {
    const admin = await steppedAdmin();
    const salon = await newSalon("سالن با تیم");
    const artistApi = createClient();
    await registerUser(artistApi, { type: "artist", name: `هم‌تیمی ${tag()}` });
    expect((await joinSalonAsArtist(artistApi, salon.api, salon.user.id)).ok).toBe(true);
    const refused = await admin.post(`/api/admin/users/${salon.user.id}/type`, { to: "artist" });
    expect(refused.status).toBe(409);
    expect(refused.payload.code).toBe("team");
  });

  it("is refused for a client or an artist, without the password re-check, and for someone not an admin", async () => {
    const admin = await steppedAdmin();
    const clientApi = createClient();
    const client = await registerUser(clientApi, { type: "client", name: "فقط مشتری" });
    expect((await admin.post(`/api/admin/users/${client.user.id}/type`, { to: "artist" })).payload.code).toBe("not_salon");

    const salon = await newSalon("سالن بی‌اجازه");
    expect((await salon.api.post(`/api/admin/users/${salon.user.id}/type`, { to: "artist" })).status).toBe(403);
    expect((await createClient().get(`/api/admin/users/${salon.user.id}/type`)).status).toBe(403);
    const [row] = await sql("SELECT type FROM users WHERE id = $1", [salon.user.id]);
    expect(row.type).toBe("salon");
  });
});
