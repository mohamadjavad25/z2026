import { describe, it, expect } from "vitest";
import { createClient, futureBookingDay, joinSalonAsArtist, registerUser } from "./helpers.js";
import { q } from "./exitHelpers.js";

/**
 * The two faults the system review of 2026-11-11 proved (docs/TIDY_WORK.md), fixed the same day on the owner's word
 * (docs/DECISIONS.md): a team seat belongs to the account that joined and to nobody else, and an artist's answer to her
 * copy of a salon booking only touches her own booking.
 */
const tag = () => String(Math.floor(Math.random() * 1e8));

describe("a team seat belongs to the account that joined", () => {
  it("a new artist who takes a deleted artist's name does not land in that artist's old team", async () => {
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

    // The seat went with the account: the salon's team no longer lists the name, and the newcomer is in no team.
    const staff = (await salonClient.get("/api/salon-staff")).payload.data.staff;
    expect(staff.find((person) => person.name === name)).toBeUndefined();
    expect((await strangerClient.get("/api/artist/teams")).payload.data.teams).toEqual([]);
    // And the name is free for the newcomer to really join with.
    expect((await joinSalonAsArtist(strangerClient, salonClient, salon.user.id)).ok).toBe(true);
  });

  it("an old seat with no account is never tied to an artist by name or phone, nor by the salon naming an account", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", name: `سالن مرور ${tag()}` });
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: `آرتیست مرور ${tag()}` });
    // A row from before team members had to be accounts: the salon typed this artist's name and number.
    const [row] = await q("INSERT INTO salon_staff (salon_user_id, name, phone, role, state) VALUES ($1, $2, $3, 'ناخن', 'فعال') RETURNING id", [salon.user.id, artist.user.name, artist.phone]);

    let seat = (await salonClient.get("/api/salon-staff")).payload.data.staff.find((person) => person.id === row.id);
    expect(seat.artist_user_id ?? null).toBeNull();
    expect(seat.has_artist_profile).toBe(false);

    // The salon cannot attach an account to the seat by sending its id either.
    const patched = await salonClient.patch("/api/salon-staff", { id: row.id, artistUserId: artist.user.id, artist_user_id: artist.user.id });
    expect(patched.ok).toBe(true);
    seat = (await salonClient.get("/api/salon-staff")).payload.data.staff.find((person) => person.id === row.id);
    expect(seat.artist_user_id ?? null).toBeNull();
    expect((await q("SELECT artist_user_id FROM salon_staff WHERE id = $1", [row.id]))[0].artist_user_id).toBeNull();
    expect((await artistClient.get("/api/artist/teams")).payload.data.teams).toEqual([]);
  });
});

describe("a salon booking and its artist's calendar copy", () => {
  it("an artist declining her copy cancels her own booking, not the same client's booking with another artist", async () => {
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
