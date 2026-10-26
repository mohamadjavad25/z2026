import { describe, it, expect, afterAll } from "vitest";
import {
  newSalon, newClient, newArtist, bookSalon, hhmm, db, connected, futureBookingDay, createClient, registerUser, uniq,
  smsRows, settledSmsCount
} from "./angle3Helpers.js";
import { adminClient } from "./helpers.js";

afterAll(async () => { await connected; await db.end(); });

const same = (a, b) => a.status === b.status && JSON.stringify(a.payload) === JSON.stringify(b.payload);

describe("angle3b: cross-account access to bookings", () => {
  it("client B cannot cancel / answer client A's salon booking; foreign id looks exactly like a missing id", async () => {
    const salon = await newSalon("Idor Salon");
    const a = await newClient("Idor A");
    const b = await newClient("Idor B");
    const r = await bookSalon(a, salon, { day: futureBookingDay(2), time: hhmm(10) });
    const id = r.payload.data.booking.id;
    const foreignCancel = await b.client.post(`/api/salon-bookings/${id}/cancel`, {});
    const missingCancel = await b.client.post(`/api/salon-bookings/99999999/cancel`, {});
    const foreignAnswer = await b.client.post(`/api/salon-bookings/${id}/answer`, { accept: true });
    const missingAnswer = await b.client.post(`/api/salon-bookings/99999999/answer`, { accept: true });
    expect(foreignCancel.status).toBe(404);
    expect(foreignAnswer.status).toBe(404);
    expect(same(foreignCancel, missingCancel)).toBe(true);
    expect(same(foreignAnswer, missingAnswer)).toBe(true);
    const mine = await a.client.get("/api/client-bookings");
    expect(mine.payload.data.salonBookings.find((x) => x.id === id).status).toBe("درخواست");
    const bList = await b.client.get("/api/client-bookings");
    expect(bList.payload.data.salonBookings.length).toBe(0);
  });

  it("client B cannot cancel client A's direct artist booking", async () => {
    const artist = await newArtist("Idor Artist");
    const a = await newClient("Art A");
    const b = await newClient("Art B");
    const r = await a.client.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "ناخن", bookingDate: futureBookingDay(2), time: hhmm(10) });
    expect(r.status).toBe(201);
    const id = r.payload.data.booking.id;
    const foreign = await b.client.post(`/api/artist-bookings/${id}/cancel`, {});
    const missing = await b.client.post(`/api/artist-bookings/99999999/cancel`, {});
    expect(foreign.status).toBe(404);
    expect(same(foreign, missing)).toBe(true);
  });

  it("salon B cannot read or change salon A's booking (times, staff, patch variants) and gets the same answer as for a missing id", async () => {
    const salonA = await newSalon("Owner A");
    const salonB = await newSalon("Intruder B");
    const c = await newClient("Cust");
    const r = await bookSalon(c, salonA, { day: futureBookingDay(2), time: hhmm(10) });
    const id = r.payload.data.booking.id;
    const times = await salonB.client.get(`/api/salon-bookings/${id}/times`);
    const timesMissing = await salonB.client.get(`/api/salon-bookings/99999999/times`);
    const staff = await salonB.client.get(`/api/salon-bookings/${id}/staff`);
    expect(times.status).toBe(404);
    expect(staff.status).toBe(404);
    expect(same(times, timesMissing)).toBe(true);
    for (const patch of [
      { id, status: "تایید شده" }, { id, status: "لغو" }, { id, action: "cancel" }, { id, autoAssign: true },
      { id, time: hhmm(12) }, { id, staff: "هر کسی" }, { id, client: "Hacked", phone: "09120000000" }
    ]) {
      const res = await salonB.client.patch("/api/salon-bookings", patch);
      expect(res.ok, JSON.stringify(patch)).toBe(false);
    }
    const mine = await salonA.client.get("/api/salon-bookings");
    const row = mine.payload.data.bookings.find((x) => x.id === id);
    expect(row.status).toBe("درخواست");
    expect(row.time).toBe("10:00");
    expect(row.client).toBe(c.user.name);
  });

  it("wrong roles cannot act as a salon or as another role", async () => {
    const salon = await newSalon("Role Salon");
    const c = await newClient("Role Client");
    const artist = await newArtist("Role Artist");
    const r = await bookSalon(c, salon, { day: futureBookingDay(2), time: hhmm(10) });
    const id = r.payload.data.booking.id;
    for (const who of [c, artist]) {
      expect((await who.client.patch("/api/salon-bookings", { id, status: "تایید شده" })).status).toBe(403);
      expect((await who.client.get(`/api/salon-bookings/${id}/times`)).status).toBe(403);
      expect((await who.client.get(`/api/salon-bookings/${id}/staff`)).status).toBe(403);
    }
    // artist cannot create a salon booking, client cannot cancel via artist route, salon cannot use client routes
    expect((await artist.client.post("/api/salon-bookings", { salonUserId: salon.user.id, service: "کراتین مو", bookingDate: futureBookingDay(3), time: hhmm(11) })).status).toBe(403);
    expect((await salon.client.post(`/api/salon-bookings/${id}/cancel`, {})).status).toBe(403);
    expect((await salon.client.post(`/api/salon-bookings/${id}/answer`, { accept: true })).status).toBe(403);
    expect((await artist.client.get("/api/client-bookings")).status).toBe(403);
    expect((await salon.client.get("/api/client-bookings")).status).toBe(403);
    // a salon cannot book into another salon's calendar
    const other = await newSalon("Other Salon");
    const cross = await salon.client.post("/api/salon-bookings", { salonUserId: other.user.id, service: "کراتین مو", client: "x", phone: "09120000000", bookingDate: futureBookingDay(3), time: hhmm(12) });
    expect(cross.status).toBe(403);
    // unauthenticated
    const anon = createClient();
    expect((await anon.get("/api/salon-bookings")).status).toBe(401);
    expect((await anon.post(`/api/salon-bookings/${id}/cancel`, {})).status).toBe(401);
    expect((await anon.get("/api/client-bookings")).status).toBe(401);
  });

  it("artist B cannot answer artist A's direct booking via /api/artist/me", async () => {
    const artistA = await newArtist("ArtA");
    const artistB = await newArtist("ArtB");
    const c = await newClient("Art Cust");
    const r = await c.client.post("/api/artist/bookings", { artistUserId: artistA.user.id, service: "ناخن", bookingDate: futureBookingDay(2), time: hhmm(10) });
    const id = r.payload.data.booking.id;
    for (const status of ["تایید شده", "لغو"]) {
      const res = await artistB.client.patch("/api/artist/me", { kind: "booking", id, status });
      expect(res.status, status).toBe(404);
    }
    expect((await c.client.patch("/api/artist/me", { kind: "booking", id, status: "تایید شده" })).status).toBe(403);
  });

  it("a client cannot book 'as' another client by sending client_user_id / clientUserId in the body", async () => {
    const salon = await newSalon("Spoof Id Salon");
    const a = await newClient("Real A");
    const victim = await newClient("Victim V");
    const r = await bookSalon(a, salon, { day: futureBookingDay(2), time: hhmm(10), extra: { clientUserId: victim.user.id, client_user_id: victim.user.id, status: "تایید شده" } });
    expect(r.status).toBe(201);
    expect(r.payload.data.booking.client_user_id).toBe(a.user.id);
    expect(r.payload.data.booking.status).toBe("درخواست");
    const v = await victim.client.get("/api/client-bookings");
    expect(v.payload.data.salonBookings.length).toBe(0);
  });

  it("the public availability view of a salon never shows who booked", async () => {
    const salon = await newSalon("Avail Salon");
    const secret = await newClient("RealPerson-Zq9");
    const r = await bookSalon(secret, salon, { day: futureBookingDay(2), time: hhmm(10), extra: { client: "RealPerson-Zq9" } });
    expect(r.status).toBe(201);
    const peeker = await newClient("Peeker");
    const view = await peeker.client.get(`/api/salon-bookings?salonUserId=${salon.user.id}`);
    const text = JSON.stringify(view.payload);
    expect(text).not.toContain("RealPerson-Zq9");
    expect(text).not.toContain(secret.phone);
    expect(text).not.toContain(String(secret.user.id) === "1" ? "never" : `"client_user_id"`);
    const keys = Object.keys(view.payload.data.unavailableSlots[0]).sort();
    console.log("[avail] slot keys exposed to any client:", keys.join(","));
    // an artist and another salon see the same thing
    const otherSalon = await newSalon("Peek Salon");
    const sView = await otherSalon.client.get(`/api/salon-bookings?salonUserId=${salon.user.id}`);
    expect(JSON.stringify(sView.payload)).not.toContain(secret.phone);
    // anonymous is refused
    expect((await createClient().get(`/api/salon-bookings?salonUserId=${salon.user.id}`)).status).toBe(401);
  });
});

describe("angle3b: account state vs sessions", () => {
  it("a suspended client's existing session stops working at once", async () => {
    const c = await newClient("To Suspend");
    expect((await c.client.get("/api/auth/me")).payload.data.user).not.toBeNull();
    const admin = await adminClient();
    const res = await admin.post(`/api/admin/users/${c.user.id}/suspend`, { suspended: true, reason: "angle3" });
    console.log("[suspend] admin call ->", res.status);
    expect(res.ok).toBe(true);
    expect((await c.client.get("/api/auth/me")).payload.data.user).toBeNull();
    expect((await c.client.get("/api/client-bookings")).status).toBe(401);
  });

  it("a suspended salon is out of the directory, its page, name search and takes no new requests", async () => {
    const salon = await newSalon("Suspended Salon");
    const client = await newClient("Susp Cust");
    const admin = await adminClient();
    const res = await admin.post(`/api/admin/users/${salon.user.id}/suspend`, { suspended: true, reason: "angle3" });
    expect(res.ok).toBe(true);
    const anon = createClient();
    const page = await anon.get(`/api/salons/${salon.user.id}`);
    const list = await anon.get("/api/salons?limit=50");
    const inList = (list.payload.data.salons || []).some((s) => s.id === salon.user.id);
    const booking = await bookSalon(client, salon, { day: futureBookingDay(2), time: hhmm(10) });
    const avail = await client.client.get(`/api/salon-bookings?salonUserId=${salon.user.id}`);
    const connect = await client.client.post("/api/connections", { targetUserId: salon.user.id });
    const follow = await client.client.post("/api/follows", { targetUserId: salon.user.id });
    console.log("[suspended salon] page", page.status, "inDirectory", inList, "booking", booking.status, "availability", avail.status, "connect", connect.status, "follow", follow.status);
    await admin.post(`/api/admin/users/${salon.user.id}/suspend`, { suspended: false });
    expect(page.status).toBe(404);
    expect(inList).toBe(false);
    expect(booking.ok).toBe(false);
  });

  it("changing the password logs out the other sessions", async () => {
    const first = createClient();
    const acc = await registerUser(first, { type: "client", name: "Pw Changer" });
    const second = createClient();
    const login = await second.post("/api/auth/login", { phone: acc.phone, password: acc.password });
    expect(login.ok).toBe(true);
    const change = await first.post("/api/profile", { data: { password: "brandnewpass456", currentPassword: acc.password } });
    expect(change.ok).toBe(true);
    const stolen = await second.get("/api/client-bookings");
    console.log("[pw-change] old session after password change ->", stolen.status);
    expect(stolen.status).toBe(401);
  });

  it("a deleted account's session and data die with it", async () => {
    const salon = await newSalon("Del Salon");
    const c1 = createClient();
    const acc = await registerUser(c1, { type: "client", name: "Deleter" });
    const dup = createClient();
    await dup.post("/api/auth/login", { phone: acc.phone, password: acc.password });
    await bookSalon({ client: c1, user: acc.user, phone: acc.phone }, salon, { day: futureBookingDay(2), time: hhmm(10) });
    // An open request asks first (owner's decision 2026-10-26): «لغو همه و پاک کردن حساب».
    const asked = await c1.delete("/api/profile", { currentPassword: acc.password });
    expect(asked.status).toBe(409);
    const del = await c1.delete("/api/profile", { currentPassword: acc.password, cancelAll: true });
    expect(del.ok).toBe(true);
    expect((await dup.get("/api/auth/me")).payload.data.user).toBeNull();
    expect((await dup.get("/api/client-bookings")).status).toBe(401);
    // the salon still has the (now orphaned) booking with the person's name and number: record what stays
    const list = await salon.client.get("/api/salon-bookings");
    const row = list.payload.data.bookings[0];
    console.log("[delete] salon still sees phone", row?.phone, "client_user_id", row?.client_user_id);
  });
});

describe("angle3b: phone is the key to a person's booking history", () => {
  it("changing the phone in the profile needs proof of the new number (an SMS code)", async () => {
    const acc = await newClient("Phone Changer", { verified: true });
    const target = `0912${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
    const res = await acc.client.post("/api/profile", { data: { phone: target } });
    console.log("[phone-change] POST /api/profile phone without any code ->", res.status);
    expect(res.ok).toBe(false);
  });

  it("a verified account cannot read another person's walk-in bookings by changing its phone to theirs", async () => {
    const salon = await newSalon("Walkin Salon");
    const victimPhone = `0912${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
    const walkin = await salon.client.post("/api/salon-bookings", {
      salonUserId: salon.user.id, service: "کراتین مو", client: "Victim Walkin", phone: victimPhone, bookingDate: futureBookingDay(2), time: hhmm(10)
    });
    expect(walkin.status).toBe(201);
    const attacker = await newClient("Attacker", { verified: true });
    await attacker.client.post("/api/profile", { data: { phone: victimPhone } });
    const mine = await attacker.client.get("/api/client-bookings");
    const seen = mine.payload?.data?.salonBookings || [];
    console.log("[phone-takeover] attacker sees", seen.length, "bookings of the number", victimPhone, seen[0]?.client);
    expect(seen.length).toBe(0);
    if (seen[0]) {
      const cancel = await attacker.client.post(`/api/salon-bookings/${seen[0].id}/cancel`, {});
      console.log("[phone-takeover] attacker cancel ->", cancel.status);
      expect(cancel.ok).toBe(false);
    }
  });

  it("a salon cannot redirect its booking SMS to an arbitrary number by editing its phone", async () => {
    const salon = await newSalon("Redirect Salon");
    const client = await newClient("Redirect Cust");
    const victim = `0912${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
    await salon.client.post("/api/profile", { data: { phone: victim } });
    const r = await bookSalon(client, salon, { day: futureBookingDay(2), time: hhmm(10), extra: { client: "پیام جعلی: به این لینک برو" } });
    expect(r.status).toBe(201);
    const n = await settledSmsCount({ phone: victim, purpose: "booking_request" });
    console.log("[sms-redirect] SMS delivered to an unverified number the salon typed in:", n);
    expect(n).toBe(0);
  });

  it("a client's free-text name travels verbatim into the salon's SMS (length / content)", async () => {
    const salon = await newSalon("Text Salon");
    const client = await newClient("Text Cust");
    const longName = "ه".repeat(120);
    await bookSalon(client, salon, { day: futureBookingDay(2), time: hhmm(10), extra: { client: longName } });
    await settledSmsCount({ phone: salon.phone, purpose: "booking_request" });
    const rows = await smsRows({ phone: salon.phone, purpose: "booking_request" });
    console.log("[sms-text] length of SMS body:", rows[0]?.body?.length);
    expect(rows[0].body.length).toBeLessThan(200);
  });
});

describe("angle3b: information leaks (phone enumeration, public payloads)", () => {
  // The owner chose to say plainly when a number already has an account (decision 2026-10-25): login says there is
  // no account with that number, and sign-up sends the visitor to the login with the number filled in. What keeps
  // anyone from testing numbers in bulk is the per-number and per-address limits, checked here.
  it("login says plainly whether a number has an account, and the address limit still stops a sweep", async () => {
    const acc = await newClient("Enum Target");
    const anon = createClient();
    const unknown = `0912${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
    const h1 = { headers: { "x-real-ip": `10.60.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } };
    const known = await anon.post("/api/auth/login", { phone: acc.phone, password: "wrong-password-1" }, h1);
    const none = await anon.post("/api/auth/login", { phone: unknown, password: "wrong-password-1" }, h1);
    expect(known.ok).toBe(false);
    expect(none.ok).toBe(false);
    expect(none.payload.error).not.toBe(known.payload.error);
    let limited = null;
    for (let i = 0; i < 40 && !limited; i += 1) {
      const res = await anon.post("/api/auth/login", { phone: `0912${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`, password: "wrong-password-1" }, h1);
      if (res.status === 429) limited = res;
    }
    expect(limited?.status).toBe(429);
  });

  it("sign-up says a number already has an account (code phone_taken) and sends no SMS for it", async () => {
    const acc = await newClient("Enum Target 2");
    const anon = createClient();
    const unknown = `0912${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
    const h = { headers: { "x-real-ip": `10.61.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } };
    const a = await anon.post("/api/auth/otp/send", { phone: acc.phone, purpose: "register" }, h);
    const b = await anon.post("/api/auth/otp/send", { phone: unknown, purpose: "register" }, h);
    expect(a.status).toBe(409);
    expect(a.payload).toMatchObject({ code: "phone_taken", error: "این شماره حساب داره؛ با رمزت وارد شو." });
    expect(b.ok).toBe(true);
    expect(await smsRows({ phone: acc.phone, purpose: "register" })).toHaveLength(0);
  });

  it("the public salon page does not publish the owner's login phone", async () => {
    const salon = await newSalon("Public Phone Salon");
    const res = await createClient().get(`/api/salons/${salon.user.id}`);
    console.log("[public-phone] /api/salons/:id exposes phone:", res.payload.data.salon.phone, "(login phone is", salon.phone, ")");
    expect(JSON.stringify(res.payload)).not.toContain(salon.phone);
  });

  it("the public artist page does not publish the artist's login phone", async () => {
    const artist = await newArtist("Public Phone Artist");
    const res = await createClient().get(`/api/artists/${artist.user.id}`);
    console.log("[public-phone] /api/artists/:id contains login phone:", JSON.stringify(res.payload).includes(artist.phone));
    expect(JSON.stringify(res.payload)).not.toContain(artist.phone);
  });

  it("a public salon page that lists staff does not publish staff phone numbers or emails", async () => {
    const salon = await newSalon("Staff Leak Salon");
    const art = await newArtist("Staff Artist");
    await salon.client.post("/api/salon-staff", { name: "Team Member", role: "آرایشگر" }).catch(() => null);
    const res = await createClient().get(`/api/salons/${salon.user.id}`);
    const text = JSON.stringify(res.payload);
    expect(text).not.toContain(art.phone);
    expect(text).not.toMatch(/"email":"[^"]+@/);
  });

  it("a client's phone number stays out of the salon directory, search and connection cards", async () => {
    const salon = await newSalon("Card Salon");
    const client = await newClient("Card Client");
    await client.client.post("/api/connections", { targetUserId: salon.user.id });
    const search = await client.client.get(`/api/connections/search?q=${encodeURIComponent(salon.phone)}`);
    const mine = await client.client.get("/api/connections?services=1");
    for (const payload of [search.payload, mine.payload]) {
      expect(JSON.stringify(payload)).not.toContain(salon.phone);
    }
    const list = await createClient().get("/api/salons?limit=50");
    expect(JSON.stringify(list.payload)).not.toContain(client.phone);
  });
});
