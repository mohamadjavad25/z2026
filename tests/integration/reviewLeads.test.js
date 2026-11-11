import { describe, it, expect } from "vitest";
import { createClient, futureBookingDay, joinSalonAsArtist, registerUser } from "./helpers.js";

/**
 * Leads from the system review of 2026-11-11 (docs/TIDY_WORK.md, «System review»). Each test says what should be
 * true. One written with `it.fails` is a proven fault that is not fixed yet (the fix changes behaviour, so the owner
 * decides first): the day it is fixed that test turns red and `it.fails` becomes `it`.
 */
const tag = () => String(Math.floor(Math.random() * 1e8));

describe("review leads: a team seat after its artist is gone", () => {
  it.fails("a new artist who takes a deleted artist's name does not land in that artist's old team", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", name: `سالن مرور ${tag()}` });
    const name = `آرتیست مرور ${tag()}`;
    const firstClient = createClient();
    const first = await registerUser(firstClient, { type: "artist", name });
    expect((await joinSalonAsArtist(firstClient, salonClient, salon.user.id)).ok).toBe(true);

    const gone = await firstClient.delete("/api/profile", { currentPassword: first.password });
    expect(gone.ok).toBe(true);

    // Someone else, with another phone number, signs up under the name that is free again.
    const strangerClient = createClient();
    const stranger = await registerUser(strangerClient, { type: "artist", name });
    expect(stranger.user.name).toBe(name);

    const staff = (await salonClient.get("/api/salon-staff")).payload.data.staff;
    const seat = staff.find((person) => person.name === name);
    const teams = (await strangerClient.get("/api/artist/teams")).payload.data.teams;
    expect(seat?.artist_user_id ?? null).toBeNull();
    expect(teams).toEqual([]);
  });
});

describe("review leads: a salon booking and its artist's calendar copy", () => {
  it.fails("an artist declining her copy cancels her own booking, not the same client's booking with another artist", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", menu: true, name: `سالن مرور ${tag()}` });
    await salonClient.get("/api/salon-hours");
    const artists = [];
    for (const label of ["یک", "دو"]) {
      const api = createClient();
      const me = await registerUser(api, { type: "artist", menu: true, name: `آرتیست ${label} ${tag()}` });
      expect((await joinSalonAsArtist(api, salonClient, salon.user.id)).ok).toBe(true);
      artists.push({ api, me });
    }
    const staff = (await salonClient.get("/api/salon-staff")).payload.data.staff;
    const day = futureBookingDay(3);
    // A mother books for herself and her daughter under her own name and number: same service, same time, two artists.
    const made = [];
    for (const artist of artists) {
      const seat = staff.find((person) => Number(person.artist_user_id) === Number(artist.me.user.id));
      const res = await salonClient.post("/api/salon-bookings", { service: "کوتاهی مو", staff: seat.name, bookingDate: day, time: "۱۲:۰۰", client: "مادر و دختر", phone: "09120001234", status: "تازه" });
      expect(res.ok).toBe(true);
      made.push(res.payload.data.booking);
    }
    // The first artist says no to hers.
    const mine = (await artists[0].api.get("/api/artist/me")).payload.data.bookings;
    const copy = mine.find((b) => b.client_name === "مادر و دختر");
    expect(copy).toBeTruthy();
    expect((await artists[0].api.patch("/api/artist/me", { kind: "booking", id: copy.id, status: "لغو", action: "cancel" })).ok).toBe(true);
    const list = (await salonClient.get("/api/salon-bookings")).payload.data.bookings;
    const status = (id) => list.find((b) => b.id === id)?.status;
    expect(status(made[0].id)).toBe("لغو");
    expect(status(made[1].id)).not.toBe("لغو");
  });
});
