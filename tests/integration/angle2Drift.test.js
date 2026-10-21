import { describe, it, expect, afterAll } from "vitest";
import { joinSalonAsArtist, adminClient } from "./helpers.js";
import { closeDb, q, note, pickDay, plain, newSalon, newClient, newArtist, bookAtSalon, cron, salonRows, artistRows, deleteAccount, keyAhead } from "./angle2Util.js";

afterAll(closeDb);

const PAST = () => keyAhead(-3);

async function salonWithTeam() {
  const salon = await newSalon("Drift Salon");
  const artist = await newArtist("Drift Staff");
  const join = await joinSalonAsArtist(artist.api, salon.api, salon.id);
  expect(join.ok).toBe(true);
  const staff = (await salon.api.get("/api/salon-staff")).payload.data.staff;
  return { salon, artist, staff: staff[0] };
}

describe("a salon account is deleted while clients have bookings with it", () => {
  async function setup() {
    const salon = await newSalon("Doomed Salon");
    const client = await newClient("Orphan Client", { verified: true });
    const d1 = pickDay({ min: 3 });
    const d2 = pickDay({ min: d1.offset + 1, max: 20 });
    const pending = (await bookAtSalon(client.api, salon, client, { day: d1.key, time: "۱۱:۰۰" })).payload.data.booking;
    const confirmedRes = (await bookAtSalon(client.api, salon, client, { day: d2.key, time: "۱۲:۰۰" })).payload.data.booking;
    await salon.api.patch("/api/salon-bookings", { id: confirmedRes.id, status: "تایید شده" });
    await deleteAccount(salon);
    return { salon, client, pending, confirmed: confirmedRes, d1, d2 };
  }

  it("the client's lists still answer 200 and show a deleted-salon label (no 500)", async () => {
    const { client, pending } = await setup();
    const res = await client.api.get("/api/client-bookings");
    expect(res.status).toBe(200);
    const row = res.payload.data.salonBookings.find((b) => b.id === pending.id);
    expect(row).toBeTruthy();
    expect(row.salonName).toBe("سالن حذف‌شده");
    expect((await client.api.get("/api/salon-bookings")).status).toBe(200);
  });

  it("the client can still cancel both the pending and the confirmed booking at the deleted salon", async () => {
    const { client, pending, confirmed } = await setup();
    const a = await client.api.post(`/api/salon-bookings/${pending.id}/cancel`, {});
    const b = await client.api.post(`/api/salon-bookings/${confirmed.id}/cancel`, {});
    expect([a.status, b.status], JSON.stringify([a.payload, b.payload])).toEqual([200, 200]);
  });

  it("the expiry sweep closes a pending request of a deleted salon once its day has passed (it does not stay 'درخواست' forever)", async () => {
    const { pending, client } = await setup();
    await q("UPDATE salon_bookings SET booking_date = $2 WHERE id = $1", [pending.id, PAST()]);
    const first = await cron("expire-bookings");
    expect(first.status).toBe(200);
    await cron("expire-bookings");
    const [row] = await q("SELECT status FROM salon_bookings WHERE id = $1", [pending.id]);
    expect(row.status, "client still sees a live request for a salon that no longer exists").not.toBe("درخواست");
    void client;
  });

  it("new booking, availability, preview and profile of the deleted salon are 404 (not 500)", async () => {
    const { salon, client } = await setup();
    const day = pickDay({ min: 4 }).key;
    expect((await bookAtSalon(client.api, salon, client, { day, time: "۱۱:۰۰" })).status).toBe(404);
    expect((await client.api.get(`/api/salon-bookings/availability?salonUserId=${salon.id}&day=${day}&service=x&minutes=60`)).status).toBe(404);
    const preview = await client.api.get(`/api/salon-bookings/preview?salonUserId=${salon.id}&day=${day}&time=11:00&service=x&minutes=60`);
    expect(preview.status).toBeLessThan(500);
    expect((await client.api.get(`/api/salons/${salon.id}`)).status).toBe(404);
    expect((await client.api.get(`/api/salon-bookings?salonUserId=${salon.id}`)).status).toBeLessThan(500);
  });

  it("the admin can still list and cancel a booking of a deleted salon", async () => {
    const { pending } = await setup();
    const admin = await adminClient();
    expect((await admin.get("/api/admin/bookings?limit=50")).status).toBe(200);
    const res = await admin.post(`/api/admin/bookings/salon/${pending.id}`, { action: "cancel" });
    note("admin cancel of orphan booking ->", res.status, JSON.stringify(res.payload).slice(0, 100));
    expect(res.status).toBeLessThan(500);
    const [row] = await q("SELECT status FROM salon_bookings WHERE id = $1", [pending.id]);
    expect(row.status).toBe("لغو");
  });

  it("the reminder sweep never throws for confirmed bookings of a deleted salon", async () => {
    const { confirmed } = await setup();
    const [row] = await q("SELECT booking_date, time FROM salon_bookings WHERE id = $1", [confirmed.id]);
    const { bookingStartMs } = await import("../../app/shared/lib/reminderTiming.js");
    const start = bookingStartMs(row.booking_date, row.time, new Date());
    const res = await cron("send-reminders", { now: new Date(start - 90 * 60000).toISOString() });
    expect(res.status).toBe(200);
    note("reminder sweep for deleted salon's confirmed booking:", JSON.stringify(res.payload.data));
  });
});

describe("a salon with a team is deleted: the artists' calendar copies", () => {
  it("do not turn into duplicate 'direct' bookings in the client's artist list", async () => {
    const { salon, artist, staff } = await salonWithTeam();
    const client = await newClient("Dup Client", { verified: true });
    const day = pickDay({ min: 3 });
    const res = await client.api.post("/api/salon-bookings", { salonUserId: salon.id, service: "کوتاهی مو", staff: staff.name, bookingDate: day.key, time: "۱۱:۰۰", client: client.user.name, phone: client.phone });
    expect(res.status).toBe(201);
    expect((await client.api.get("/api/artist-bookings")).payload.data.bookings).toHaveLength(0);
    await deleteAccount(salon);
    const after = (await client.api.get("/api/artist-bookings")).payload.data.bookings;
    expect(after, "mirror rows lost source_salon_user_id (ON DELETE SET NULL) and now look like the client's own direct artist bookings").toHaveLength(0);
    void artist;
  });
});

describe("an artist account is deleted", () => {
  it("a client's direct booking can still be cancelled, lists work, and a new booking for that id is a 404", async () => {
    const artist = await newArtist();
    const client = await newClient("Artist Orphan", { verified: true });
    const day = pickDay({ min: 3 });
    const made = await client.api.post("/api/artist/bookings", { artistUserId: artist.id, service: "مانیکور", bookingDate: day.key, time: "۱۱:۰۰", clientName: client.user.name, clientPhone: client.phone });
    expect(made.status).toBe(201);
    await deleteAccount(artist);
    const list = await client.api.get("/api/artist-bookings");
    expect(list.status).toBe(200);
    expect(list.payload.data.bookings[0].salonName).toBe("آرتیست حذف‌شده");
    const again = await client.api.post("/api/artist/bookings", { artistUserId: artist.id, service: "مانیکور", bookingDate: day.key, time: "۱۴:۰۰", clientName: client.user.name, clientPhone: client.phone });
    expect(again.status).toBe(404);
    const cancel = await client.api.post(`/api/artist-bookings/${made.payload.data.booking.id}/cancel`, {});
    expect(cancel.status).toBe(200);
  });

  it("booking an id that is not an artist (a client, a salon, a nonexistent id) is a 404, not a calendar row or a 500", async () => {
    const client = await newClient();
    const salon = await newSalon();
    const day = pickDay({ min: 3 }).key;
    const problems = [];
    for (const id of [client.id, salon.id, 99999999, 0, -1]) {
      const res = await client.api.post("/api/artist/bookings", { artistUserId: id, service: "مانیکور", bookingDate: day, time: "۱۱:۰۰", clientName: client.user.name, clientPhone: client.phone });
      if (res.status !== 404 && res.status !== 400) problems.push(`artistUserId=${id} -> ${res.status}`);
    }
    expect(problems).toEqual([]);
  });

  it("an artist who is part of a salon team and gets deleted leaves the salon's own booking list and actions working", async () => {
    const { salon, artist, staff } = await salonWithTeam();
    const client = await newClient("Staff Gone", { verified: true });
    const day = pickDay({ min: 3 });
    const res = await client.api.post("/api/salon-bookings", { salonUserId: salon.id, service: "کوتاهی مو", staff: staff.name, bookingDate: day.key, time: "۱۱:۰۰", client: client.user.name, phone: client.phone });
    expect(res.status).toBe(201);
    await deleteAccount(artist);
    expect((await salon.api.get("/api/salon-bookings")).status).toBe(200);
    expect((await salon.api.get("/api/salon-staff")).status).toBe(200);
    const confirm = await salon.api.patch("/api/salon-bookings", { id: res.payload.data.booking.id, status: "تایید شده" });
    expect(confirm.status, JSON.stringify(confirm.payload)).toBe(200);
    expect((await client.api.post(`/api/salon-bookings/${res.payload.data.booking.id}/cancel`, {})).status).toBe(200);
  });
});

describe("a staff member / team artist is removed while bookings with them exist", () => {
  async function bookedWithArtist() {
    const ctx = await salonWithTeam();
    const client = await newClient("Ghost Client");
    const day = pickDay({ min: 3 });
    const res = await client.api.post("/api/salon-bookings", { salonUserId: ctx.salon.id, service: "کوتاهی مو", staff: ctx.staff.name, bookingDate: day.key, time: "۱۱:۰۰", client: client.user.name, phone: client.phone });
    expect(res.status).toBe(201);
    return { ...ctx, client, day, booking: res.payload.data.booking };
  }
  const mirrors = (artistId) => q("SELECT id, status FROM artist_bookings WHERE artist_user_id = $1 AND status NOT IN ('لغو','منقضی شده')", [artistId]);

  it("salon deletes the staff member, later cancels the booking: the artist's calendar is freed", async () => {
    const ctx = await bookedWithArtist();
    expect(await mirrors(ctx.artist.id)).toHaveLength(1);
    const del = await ctx.salon.api.delete("/api/salon-staff", { id: ctx.staff.id });
    expect(del.status).toBe(200);
    const cancel = await ctx.salon.api.patch("/api/salon-bookings", { id: ctx.booking.id, status: "لغو" });
    expect(cancel.status).toBe(200);
    expect(await mirrors(ctx.artist.id), "salon booking cancelled but the artist's copy is still active and blocks their time").toHaveLength(0);
  });

  it("artist leaves the team, the client cancels: the artist's calendar is freed", async () => {
    const ctx = await bookedWithArtist();
    const left = await ctx.artist.api.delete("/api/artist/teams", { salonUserId: ctx.salon.id });
    expect(left.status).toBe(200);
    const cancel = await ctx.client.api.post(`/api/salon-bookings/${ctx.booking.id}/cancel`, {});
    expect(cancel.status).toBe(200);
    expect(await mirrors(ctx.artist.id)).toHaveLength(0);
  });

  it("artist leaves the team: the artist's future copies of that salon's bookings are not left running forever (cancelled or at least cancellable by the artist, which then cancels the salon row)", async () => {
    const ctx = await bookedWithArtist();
    await ctx.artist.api.delete("/api/artist/teams", { salonUserId: ctx.salon.id });
    const mine = (await ctx.artist.api.get("/api/artist/me")).payload.data.bookings.filter((b) => !["لغو", "منقضی شده"].includes(b.status));
    if (!mine.length) return; // cleaned up: fine
    const cancel = await ctx.artist.api.patch("/api/artist/me", { kind: "booking", id: mine[0].id, status: "لغو", action: "cancel" });
    expect(cancel.status).toBe(200);
    const [row] = await q("SELECT status FROM salon_bookings WHERE id = $1", [ctx.booking.id]);
    expect(row.status).toBe("لغو");
  });

  it("a deleted service: existing bookings stay listed, confirmable and cancellable", async () => {
    const salon = await newSalon("Svc Salon");
    const client = await newClient();
    const svc = await salon.api.post("/api/salon-services", { name: "خدمت موقت", price: "۱۰۰", duration: "۶۰ دقیقه", emoji: "gem" });
    expect(svc.status).toBe(201);
    const day = pickDay({ min: 3 }).key;
    const made = await bookAtSalon(client.api, salon, client, { day, time: "۱۱:۰۰", service: "خدمت موقت" });
    expect(made.status).toBe(201);
    expect((await salon.api.delete("/api/salon-services", { id: svc.payload.data.service.id })).status).toBe(200);
    expect((await salon.api.get("/api/salon-bookings")).status).toBe(200);
    expect((await client.api.get("/api/client-bookings")).status).toBe(200);
    expect((await salon.api.patch("/api/salon-bookings", { id: made.payload.data.booking.id, status: "تایید شده" })).status).toBe(200);
    expect((await client.api.post(`/api/salon-bookings/${made.payload.data.booking.id}/cancel`, {})).status).toBe(200);
  });
});

describe("a salon changes its hours or closes a day while bookings exist", () => {
  it("existing bookings stay listed, can be approved and cancelled; the closed day takes no new ones", async () => {
    const salon = await newSalon("Hours Salon");
    const client = await newClient();
    const day = pickDay({ min: 3 });
    const made = await bookAtSalon(client.api, salon, client, { day: day.key, time: "۱۹:۰۰" });
    expect(made.status).toBe(201);
    const hours = (await salon.api.get("/api/salon-hours")).payload.data.hours;
    const row = hours.find((h) => plain(h.day) === plain(day.weekday));
    expect((await salon.api.patch("/api/salon-hours", { day: row.day, closeTime: "۱۷:۰۰" })).status).toBe(200);
    expect((await salon.api.patch("/api/salon-bookings", { id: made.payload.data.booking.id, status: "تایید شده" })).status).toBeLessThan(500);
    expect((await salon.api.patch("/api/salon-hours", { day: row.day, active: false })).status).toBe(200);
    const list = await salon.api.get("/api/salon-bookings");
    expect(list.status).toBe(200);
    expect(list.payload.data.bookings.some((b) => b.id === made.payload.data.booking.id)).toBe(true);
    const other = await newClient();
    const blocked = await bookAtSalon(other.api, salon, other, { day: day.key, time: "۱۱:۰۰" });
    expect(blocked.status).toBe(409);
    const moveTimes = await salon.api.get(`/api/salon-bookings/${made.payload.data.booking.id}/times?day=${day.key}`);
    expect(moveTimes.status).toBeLessThan(500);
    expect((await client.api.post(`/api/salon-bookings/${made.payload.data.booking.id}/cancel`, {})).status).toBe(200);
  });

  it("a salon renamed after a booking shows the new name to the client and in reminders", async () => {
    const salon = await newSalon("Old Name Salon");
    const client = await newClient();
    const day = pickDay({ min: 3 });
    const made = await bookAtSalon(client.api, salon, client, { day: day.key, time: "۱۱:۰۰" });
    const rename = await salon.api.post("/api/profile", { name: `New Name ${salon.id}` });
    expect(rename.status, JSON.stringify(rename.payload)).toBe(200);
    const row = (await client.api.get("/api/client-bookings")).payload.data.salonBookings.find((b) => b.id === made.payload.data.booking.id);
    expect(row.salonName).toBe(`New Name ${salon.id}`);
  });
});

describe("suspended accounts", () => {
  it("a suspended salon is not bookable and not listed publicly (its owner cannot even log in to answer)", async () => {
    const salon = await newSalon("Suspended Salon");
    const client = await newClient();
    const admin = await adminClient();
    expect((await admin.post(`/api/admin/users/${salon.id}/suspend`, { suspended: true })).status).toBe(200);
    const day = pickDay({ min: 3 }).key;
    const res = await bookAtSalon(client.api, salon, client, { day, time: "۱۱:۰۰" });
    note("booking at suspended salon ->", res.status);
    expect(res.status, "a request that nobody can answer was accepted").toBeGreaterThanOrEqual(400);
    const listed = (await client.api.get("/api/salons?limit=50")).payload.data.salons.some((s) => (s.user_id || s.id || s.userId) === salon.id);
    note("suspended salon in public list:", listed);
    expect(listed).toBe(false);
  });

  it("a suspended artist is not bookable directly", async () => {
    const artist = await newArtist();
    const client = await newClient();
    const admin = await adminClient();
    await admin.post(`/api/admin/users/${artist.id}/suspend`, { suspended: true });
    const day = pickDay({ min: 3 }).key;
    const res = await client.api.post("/api/artist/bookings", { artistUserId: artist.id, service: "مانیکور", bookingDate: day, time: "۱۱:۰۰", clientName: client.user.name, clientPhone: client.phone });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("a suspended salon's pending request still gets closed by the sweep (no stuck rows), and the client's list stays 200", async () => {
    const salon = await newSalon("Suspended Salon 2");
    const client = await newClient();
    const day = pickDay({ min: 3 }).key;
    const made = await bookAtSalon(client.api, salon, client, { day, time: "۱۱:۰۰" });
    expect(made.status).toBe(201);
    const admin = await adminClient();
    await admin.post(`/api/admin/users/${salon.id}/suspend`, { suspended: true });
    await q("UPDATE salon_bookings SET booking_date = $2 WHERE id = $1", [made.payload.data.booking.id, PAST()]);
    expect((await cron("expire-bookings")).status).toBe(200);
    const [row] = await q("SELECT status FROM salon_bookings WHERE id = $1", [made.payload.data.booking.id]);
    expect(row.status).toBe("منقضی شده");
    expect((await client.api.get("/api/client-bookings")).status).toBe(200);
  });

  it("a suspended client with bookings: the salon's list and sweep keep working", async () => {
    const salon = await newSalon("Susp Client Salon");
    const client = await newClient();
    const day = pickDay({ min: 3 }).key;
    const made = await bookAtSalon(client.api, salon, client, { day, time: "۱۱:۰۰" });
    const admin = await adminClient();
    await admin.post(`/api/admin/users/${client.id}/suspend`, { suspended: true });
    expect((await client.api.get("/api/client-bookings")).status).toBe(401);
    expect((await salon.api.get("/api/salon-bookings")).status).toBe(200);
    expect((await salon.api.patch("/api/salon-bookings", { id: made.payload.data.booking.id, status: "تایید شده" })).status).toBe(200);
    expect(await salonRows(salon.id)).toHaveLength(1);
  });
});

describe("misc orphan reads", () => {
  it("admin user detail and admin booking list survive deleted salons/artists/clients", async () => {
    const admin = await adminClient();
    for (const path of ["/api/admin/bookings?limit=100", "/api/admin/bookings?when=upcoming&limit=100", "/api/admin/bookings?when=past&limit=100", "/api/admin/dashboard", "/api/admin/stats"]) {
      const res = await admin.get(path);
      expect(res.status, path).toBeLessThan(500);
    }
    void artistRows;
  });
});
