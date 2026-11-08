import { describe, it, expect } from "vitest";
import { createClient, registerUser, FAR_DAY, confirmedAt, joinSalonAsArtist, newArtist, newClient, newSalon } from "./exitHelpers.js";

// Owner's decision of 2026-11-08: a salon's or artist's login phone is seen by the account itself, a connected client, a
// client with a booking there, and the other side of a team. Nobody else, signed in or not.
const salonPhoneFor = async (viewer, salon) => (await viewer.get(`/api/salons/${salon.id}`)).payload.data.salon.phone;
const artistPhoneFor = async (viewer, artist) => (await viewer.get(`/api/artists/${artist.id}`)).payload.data.artist.phone;
const connect = (who, target) => who.api.post("/api/follows", { targetUserId: target.id, follow: true });

describe("who sees a salon's login phone", () => {
  it("not a visitor and not a stranger who is signed in", async () => {
    const salon = await newSalon("Phone Salon Stranger");
    const stranger = await newClient("Phone Stranger");
    expect(await salonPhoneFor(createClient(), salon)).toBeUndefined();
    expect(await salonPhoneFor(stranger.api, salon)).toBeUndefined();
  });

  it("the salon itself", async () => {
    const salon = await newSalon("Phone Salon Self");
    expect(await salonPhoneFor(salon.api, salon)).toBe(salon.phone);
  });

  it("a connected client, and no longer after they disconnect", async () => {
    const salon = await newSalon("Phone Salon Connected");
    const client = await newClient("Phone Connected");
    expect((await connect(client, salon)).ok).toBe(true);
    expect(await salonPhoneFor(client.api, salon)).toBe(salon.phone);
    await client.api.post("/api/follows", { targetUserId: salon.id, follow: false });
    expect(await salonPhoneFor(client.api, salon)).toBeUndefined();
  });

  it("a client with a booking there", async () => {
    const salon = await newSalon("Phone Salon Booked");
    const client = await newClient("Phone Booked");
    await confirmedAt(salon, client, { day: FAR_DAY(4), time: "12:00" });
    expect(await salonPhoneFor(client.api, salon)).toBe(salon.phone);
  });

  it("a booking typed by the salon counts only once the client proved that number", async () => {
    const salon = await newSalon("Phone Salon Typed");
    const proved = createClient();
    const provedUser = await registerUser(proved, { type: "client", name: "Phone Proved", verified: true });
    const unproved = await newClient("Phone Unproved");
    for (const [phone, time] of [[provedUser.phone, "11:00"], [unproved.phone, "13:00"]]) {
      const made = await salon.api.post("/api/salon-bookings", { service: "کوتاهی مو", bookingDate: FAR_DAY(4), time, client: "مشتری دستی", phone });
      expect(made.status).toBe(201);
    }
    expect(await salonPhoneFor(proved, salon)).toBe(salon.phone);
    expect(await salonPhoneFor(unproved.api, salon)).toBeUndefined();
  });

  it("the artist on its team, and the salon sees the artist's", async () => {
    const salon = await newSalon("Phone Salon Team");
    const artist = await newArtist("Phone Team Artist");
    expect((await joinSalonAsArtist(artist.api, salon.api, salon.id)).ok).toBe(true);
    expect(await salonPhoneFor(artist.api, salon)).toBe(salon.phone);
    expect(await artistPhoneFor(salon.api, artist)).toBe(artist.phone);
  });
});

describe("who sees an artist's login phone", () => {
  it("not a visitor and not a stranger who is signed in; the artist does", async () => {
    const artist = await newArtist("Phone Artist Stranger");
    const stranger = await newClient("Phone Artist Stranger Client");
    expect(await artistPhoneFor(createClient(), artist)).toBeUndefined();
    expect(await artistPhoneFor(stranger.api, artist)).toBeUndefined();
    expect(await artistPhoneFor(artist.api, artist)).toBe(artist.phone);
  });

  it("a connected client", async () => {
    const artist = await newArtist("Phone Artist Connected");
    const client = await newClient("Phone Artist Connected Client");
    expect((await connect(client, artist)).ok).toBe(true);
    expect(await artistPhoneFor(client.api, artist)).toBe(artist.phone);
  });

  it("the public page's HTML never carries the number", async () => {
    const artist = await newArtist("Phone Artist Html");
    const res = await fetch(`${process.env.TEST_BASE_URL}/artists/${artist.id}`);
    expect(await res.text()).not.toContain(artist.phone);
  });
});

describe("which address a browser may save for push", () => {
  const subscription = (endpoint) => ({ subscription: { endpoint, keys: { p256dh: "BNcR", auth: "tBHI" } } });

  it("refuses a raw IP and a plain-http address, keeps a real push service", async () => {
    const client = await newClient("Push Address");
    expect((await client.api.post("/api/push/subscribe", subscription("https://127.0.0.1/hook"))).status).toBe(400);
    expect((await client.api.post("/api/push/subscribe", subscription("http://fcm.googleapis.com/fcm/send/x"))).status).toBe(400);
    expect((await client.api.post("/api/push/subscribe", subscription("https://fcm.googleapis.com.evil.example/x"))).status).toBe(400);
    expect((await client.api.post("/api/push/subscribe", subscription("https://fcm.googleapis.com/fcm/send/x"))).ok).toBe(true);
  });
});

describe("working hours from 6:00 to 24:00", () => {
  const WEEK = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
  const lateHours = { hours: WEEK.map((day) => ({ day, open_time: "۰۶:۰۰", close_time: "۲۴:۰۰", active: true })) };

  it("a salon can open at 6 and close at 24; a visit fits up to midnight and not past it", async () => {
    const salon = await newSalon("Hours Midnight Salon");
    const client = await newClient("Hours Midnight Client");
    const saved = await salon.api.patch("/api/salon-hours", lateHours);
    expect(saved.ok).toBe(true);
    expect(saved.payload.data.hours[0]).toMatchObject({ open_time: "۰۶:۰۰", close_time: "۲۴:۰۰" });

    const book = (time) => client.api.post("/api/salon-bookings", { salonUserId: salon.id, service: "کوتاهی مو", bookingDate: FAR_DAY(5), time, client: client.user.name, phone: client.phone });
    expect((await book("06:00")).status).toBe(201);
    expect((await book("23:00")).status).toBe(201); // 60 minutes: ends exactly at midnight
    expect((await book("23:30")).status).toBe(409); // would run past midnight
    expect((await book("05:30")).status).toBe(409);
    expect((await book("24:00")).ok).toBe(false);
  });

  it("an artist's day can end at 24, and a visit cannot start at 24", async () => {
    const artist = await newArtist("Hours Midnight Artist");
    const saved = await artist.api.patch("/api/artist-hours", lateHours);
    expect(saved.ok).toBe(true);
    expect(saved.payload.data.hours[0].close_time).toBe("۲۴:۰۰");
    const refused = await artist.api.patch("/api/artist-hours", { hours: [{ day: "شنبه", open_time: "۲۴:۰۰", close_time: "۲۴:۰۰", active: true }] });
    expect(refused.ok).toBe(false);
  });

  it("only 24:00 passes the end of the day, never 24:30 or 25:00", async () => {
    const salon = await newSalon("Hours Bad Close");
    for (const close of ["۲۴:۳۰", "۲۵:۰۰"]) {
      const res = await salon.api.patch("/api/salon-hours", { hours: [{ day: "شنبه", open_time: "۱۰:۰۰", close_time: close, active: true }] });
      expect(res.ok).toBe(false);
    }
  });
});
