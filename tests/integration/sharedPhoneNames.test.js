import { describe, it, expect } from "vitest";
import { uniquePhone } from "./helpers.js";
import { FAR_DAY, artistRow, newArtist, newClient, newSalon, q, salonRow } from "./exitHelpers.js";

/**
 * Owner's decision 2026-10-31 (docs/DECISIONS.md, one phone with several names): when a salon or artist, asked
 * "this number is saved as «سارا»; you typed «مریم»", chooses «اسم رو عوض کن», every booking of that number gets the new
 * name (POST /api/customers/rename). Bug seen 2026-10-30: two bookings, one number, two names -- the customers list showed
 * only one of them.
 */
const salonEntry = (salon, { phone, client, time, day = FAR_DAY(3) }) =>
  salon.api.post("/api/salon-bookings", { service: "کوتاهی مو", bookingDate: day, time, client, phone });
const artistEntry = (artist, { phone, client, time, day = FAR_DAY(3) }) =>
  artist.api.post("/api/artist/me", { kind: "booking", service: "کوتاهی مو", date: day, time, client, phone, durationMinutes: 60 });
const rename = (who, body) => who.api.post("/api/customers/rename", body);
const asLocal = (phone) => phone;
const asInternational = (phone) => `+98${phone.replace(/^0/, "")}`;

describe("one phone, several names: «اسم رو عوض کن»", () => {
  it("a salon's two bookings for one number keep their own names; the rename puts one name on both, in any phone format", async () => {
    const salon = await newSalon("Names Salon");
    const phone = uniquePhone();
    const first = await salonEntry(salon, { phone, client: "سارا", time: "10:00" });
    const second = await salonEntry(salon, { phone: asInternational(phone), client: "مریم", time: "13:00" });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const otherPhone = uniquePhone();
    const other = await salonEntry(salon, { phone: otherPhone, client: "علی", time: "15:00" });

    // The list is right already: two bookings, each with its own name.
    const list = await salon.api.get("/api/salon-bookings");
    const mine = list.payload.data.bookings.filter((item) => [first, second].some((made) => made.payload.data.booking.id === item.id));
    expect(mine.map((item) => item.client).sort()).toEqual(["سارا", "مریم"]);

    const done = await rename(salon, { phone: asLocal(phone), name: "مریم" });
    expect(done.status).toBe(200);
    expect(done.payload.data.renamed).toBe(1);
    expect((await salonRow(first.payload.data.booking.id)).client).toBe("مریم");
    expect((await salonRow(second.payload.data.booking.id)).client).toBe("مریم");
    // Another number is not touched.
    expect((await salonRow(other.payload.data.booking.id)).client).toBe("علی");
    // Doing it again changes nothing.
    expect((await rename(salon, { phone, name: "مریم" })).payload.data.renamed).toBe(0);
  });

  it("another salon's bookings for the same number are never touched", async () => {
    const salon = await newSalon("Names Salon A");
    const stranger = await newSalon("Names Salon B");
    const phone = uniquePhone();
    const mine = await salonEntry(salon, { phone, client: "سارا", time: "10:00" });
    const theirs = await salonEntry(stranger, { phone, client: "سارا", time: "10:00" });
    expect(mine.status).toBe(201);
    expect(theirs.status).toBe(201);
    expect((await rename(salon, { phone, name: "مریم" })).payload.data.renamed).toBe(1);
    expect((await salonRow(theirs.payload.data.booking.id)).client).toBe("سارا");
  });

  it("a booking tied to a frfro account keeps the account's name", async () => {
    const salon = await newSalon("Names Salon Account");
    const client = await newClient("حساب‌دار");
    const own = await client.api.post("/api/salon-bookings", {
      salonUserId: salon.user.id, service: "کوتاهی مو", bookingDate: FAR_DAY(3), time: "11:00", client: client.user.name, phone: client.phone
    });
    expect(own.status).toBe(201);
    const walkIn = await salonEntry(salon, { phone: client.phone, client: "دوستش", time: "14:00" });
    expect(walkIn.status).toBe(201);
    // The list says whose account the number is (the customers page's main name) next to the name that was typed.
    const listed = (await salon.api.get("/api/salon-bookings")).payload.data.bookings.find((item) => item.id === walkIn.payload.data.booking.id);
    expect(listed.client).toBe("دوستش");
    expect(listed.client_account_name).toBe(client.user.name);
    const done = await rename(salon, { phone: client.phone, name: "اسم جدید" });
    expect(done.status).toBe(200);
    expect((await salonRow(own.payload.data.booking.id)).client).toBe(client.user.name);
    expect((await salonRow(walkIn.payload.data.booking.id)).client).toBe("اسم جدید");
  });

  it("a salon's rename follows into the copy its artist sees, and not into an artist's own bookings", async () => {
    const salon = await newSalon("Names Salon Team");
    const artist = await newArtist("Names Team Artist");
    const phone = uniquePhone();
    const made = await salonEntry(salon, { phone, client: "سارا", time: "10:00" });
    expect(made.status).toBe(201);
    // The copy an artist of the team sees of a salon's booking (source_salon_user_id), and one of the artist's own.
    const [copy] = await q(
      `INSERT INTO artist_bookings (artist_user_id, source_salon_user_id, client_name, client_phone, service, booking_date, time, duration_minutes, status)
       VALUES ($1, $2, 'سارا', $3, 'کوتاهی مو', $4, '10:00', 60, 'تایید') RETURNING id`,
      [artist.user.id, salon.user.id, phone, FAR_DAY(3)]
    );
    const [ownBooking] = await q(
      `INSERT INTO artist_bookings (artist_user_id, client_name, client_phone, service, booking_date, time, duration_minutes, status)
       VALUES ($1, 'سارا', $2, 'کوتاهی مو', $3, '16:00', 60, 'تایید') RETURNING id`,
      [artist.user.id, phone, FAR_DAY(3)]
    );
    const done = await rename(salon, { phone, name: "مریم" });
    expect(done.payload.data.renamed).toBe(2);
    expect((await artistRow(copy.id)).client_name).toBe("مریم");
    expect((await artistRow(ownBooking.id)).client_name).toBe("سارا");
  });

  it("an independent artist renames only their own bookings", async () => {
    const artist = await newArtist("Names Artist");
    const other = await newArtist("Names Artist Other");
    const phone = uniquePhone();
    const a = await artistEntry(artist, { phone, client: "سارا", time: "10:00" });
    const b = await artistEntry(artist, { phone: asInternational(phone), client: "مریم", time: "13:00" });
    const c = await artistEntry(other, { phone, client: "سارا", time: "10:00" });
    expect([a.status, b.status, c.status]).toEqual([201, 201, 201]);
    const done = await rename(artist, { phone, name: "مریم" });
    expect(done.payload.data.renamed).toBe(1);
    expect((await artistRow(a.payload.data.booking.id)).client_name).toBe("مریم");
    expect((await artistRow(c.payload.data.booking.id)).client_name).toBe("سارا");
  });

  it("refuses a client account, a missing name and a number that is too short", async () => {
    const salon = await newSalon("Names Salon Guard");
    const client = await newClient("Guard Client");
    expect((await rename(client, { phone: client.phone, name: "مریم" })).status).toBe(403);
    expect((await rename(salon, { phone: uniquePhone(), name: "   " })).status).toBe(400);
    expect((await rename(salon, { phone: "0912", name: "مریم" })).status).toBe(400);
    expect((await rename(salon, { phone: uniquePhone(), name: "م".repeat(81) })).status).toBe(400);
    const loggedOut = await (await import("./helpers.js")).createClient().post("/api/customers/rename", { phone: uniquePhone(), name: "مریم" });
    expect(loggedOut.status).toBe(401);
  });
});
