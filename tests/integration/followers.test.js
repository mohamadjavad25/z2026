import { describe, it, expect } from "vitest";
import { createClient, futureBookingDay, registerUser } from "./helpers.js";

async function person(type, name) {
  const client = createClient();
  const user = await registerUser(client, { type, name });
  return { client, ...user };
}

const follow = (who, target, follow = true) => who.client.post("/api/follows", { targetUserId: target.user.id, follow });
const followers = async (owner) => (await owner.client.get("/api/followers")).payload.data;

describe("a follow is a contact", () => {
  it("gives the artist the follower's name and phone, new until the customers page is opened", async () => {
    const artist = await person("artist", "آرتیست تازه");
    const guest = await person("client", "نگار فالوکننده");

    expect((await followers(artist)).unseen).toBe(0);
    expect((await follow(guest, artist)).ok).toBe(true);

    const first = await followers(artist);
    expect(first.unseen).toBe(1);
    expect(first.followers).toHaveLength(1);
    expect(first.followers[0]).toMatchObject({
      userId: guest.user.id,
      name: "نگار فالوکننده",
      phone: guest.phone,
      isNew: true,
      hasBooked: false
    });

    // Following again changes nothing: still one follower, still one new.
    expect((await follow(guest, artist)).ok).toBe(true);
    expect((await followers(artist)).unseen).toBe(1);

    expect((await artist.client.post("/api/followers/seen", {})).payload.data.marked).toBe(1);
    const afterSeen = await followers(artist);
    expect(afterSeen.unseen).toBe(0);
    expect(afterSeen.followers[0].isNew).toBe(false);
  });

  it("works for a salon, and a re-follow after unfollowing is new again", async () => {
    const salon = await person("salon", "سالن تازه");
    const guest = await person("client", "مشتری سالن");

    expect((await guest.client.post("/api/salon-follow", { salonUserId: salon.user.id })).ok).toBe(true);
    expect((await followers(salon)).unseen).toBe(1);
    await salon.client.post("/api/followers/seen", {});

    expect((await follow(guest, salon, false)).payload.data.following).toBe(false);
    expect((await followers(salon)).followers).toHaveLength(0);

    expect((await follow(guest, salon, true)).payload.data.following).toBe(true);
    expect((await followers(salon)).unseen).toBe(1);
  });

  it("marks a follower who has booked, so only the others read as «not booked yet»", async () => {
    const artist = await person("artist", "آرتیست رزرو");
    const booker = await person("client", "رزروکننده");
    const watcher = await person("client", "فقط‌دنبال‌کننده");
    await follow(booker, artist);
    await follow(watcher, artist);

    const booked = await booker.client.post("/api/artist/bookings", {
      artistUserId: artist.user.id,
      service: "کوتاهی مو",
      bookingDate: futureBookingDay(2),
      time: "11:00",
      clientName: "رزروکننده",
      clientPhone: booker.phone
    });
    expect(booked.ok).toBe(true);

    const list = (await followers(artist)).followers;
    expect(list.find((row) => row.userId === booker.user.id).hasBooked).toBe(true);
    expect(list.find((row) => row.userId === watcher.user.id).hasBooked).toBe(false);
  });

  it("keeps the list private and the targets honest", async () => {
    const artist = await person("artist", "آرتیست خصوصی");
    const guest = await person("client", "مشتری");

    expect((await createClient().get("/api/followers")).status).toBe(401);
    expect((await createClient().post("/api/follows", { targetUserId: artist.user.id, follow: true })).status).toBe(401);

    // A client has no followers list to read, and cannot be followed.
    expect((await guest.client.get("/api/followers")).payload.data).toEqual({ followers: [], unseen: 0 });
    const other = await person("client", "مشتری دوم");
    expect((await follow(other, guest)).status).toBe(404);
    expect((await follow(artist, artist)).status).toBe(400);
    expect((await guest.client.post("/api/follows", { targetUserId: 999999999, follow: true })).status).toBe(404);
  });
});
