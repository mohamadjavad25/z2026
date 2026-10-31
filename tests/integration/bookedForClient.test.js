import { describe, it, expect } from "vitest";
import { uniquePhone } from "./helpers.js";
import { FAR_DAY, deleteMe, newArtist, newClient, newSalon, q, slotAhead, smsEventually, smsSettled, teamSalon } from "./exitHelpers.js";

/**
 * Owner's decisions of 2026-10-30 (docs/DECISIONS.md):
 * - a booking a salon or artist enters by hand for a client tells the client (push for an account, SMS for the number),
 *   once per booking, never for a visit already over, paid from the provider's SMS wallet;
 * - a salon deleting its account tells every artist on its team (card + push + SMS).
 */
const salonEntry = (salon, { phone, day = FAR_DAY(3), time = "11:00", client = "مشتری دستی" }) =>
  salon.api.post("/api/salon-bookings", { service: "کوتاهی مو", bookingDate: day, time, client, phone });
const artistEntry = (artist, { phone, day = FAR_DAY(3), time = "11:00", client = "مشتری دستی" }) =>
  artist.api.post("/api/artist/me", { kind: "booking", service: "کوتاهی مو", date: day, time, client, phone, durationMinutes: 60 });

describe("a booking a salon or artist enters by hand tells the client", () => {
  // (The SMS wallet is only counted while billing is on: smsCredits.js. Who pays is the provider, passed to sendClientSms.)
  it("a salon's entry for a number with no account texts that number once", async () => {
    const salon = await newSalon("Hand Salon");
    const phone = uniquePhone();
    const made = await salonEntry(salon, { phone });
    expect(made.status).toBe(201);
    const texts = await smsEventually(phone, "booking_made_for_you", 1);
    expect(texts).toHaveLength(1);
    expect(texts[0].body).toContain(salon.user.name);
    expect(texts[0].body).toContain("برایت نوبت");
    expect(await smsSettled(phone, ["booking_made_for_you"])).toBe(1);
  });

  it("a salon's entry for a client with an account reaches that client (no app push in tests, so the SMS goes)", async () => {
    const salon = await newSalon("Hand Salon Known");
    const client = await newClient("Hand Known Client");
    const made = await salonEntry(salon, { phone: client.phone, client: client.user.name, time: "12:00" });
    expect(made.status).toBe(201);
    expect(await smsEventually(client.phone, "booking_made_for_you", 1)).toHaveLength(1);
  });

  it("an artist's own entry for a client texts the client once", async () => {
    const artist = await newArtist("Hand Artist");
    const phone = uniquePhone();
    const made = await artistEntry(artist, { phone });
    expect(made.status).toBe(201);
    const texts = await smsEventually(phone, "booking_made_for_you", 1);
    expect(texts).toHaveLength(1);
    expect(texts[0].body).toContain(artist.user.name);
    expect(await smsSettled(phone, ["booking_made_for_you"])).toBe(1);
  });

  it("the same booking is never texted twice, and a second entry at the same time is not a second message", async () => {
    const salon = await newSalon("Hand Salon Twice");
    const phone = uniquePhone();
    const first = await salonEntry(salon, { phone, time: "15:00" });
    expect(first.status).toBe(201);
    await smsEventually(phone, "booking_made_for_you", 1);
    const again = await salonEntry(salon, { phone, time: "15:00" });
    const id = first.payload.data.booking.id;
    expect((await q("SELECT status FROM booking_sms_sent WHERE booking_kind = 'salon' AND booking_id = $1", [id])).map((r) => r.status)).toEqual(["made"]);
    // a refused or repeated entry adds nothing; a genuinely new booking (another row) may be texted on its own
    const sameRow = again.status === 201 && again.payload.data.booking.id === id;
    const want = again.status === 201 && !sameRow ? 2 : 1;
    expect(await smsSettled(phone, ["booking_made_for_you"])).toBe(want);
  });

  it("a visit already over is history: no message", async () => {
    const artist = await newArtist("Hand Artist Past");
    const phone = uniquePhone();
    const past = slotAhead(-180);
    const made = await artistEntry(artist, { phone, day: past.date, time: past.time });
    // whether the calendar takes an earlier slot or not, nobody is texted about it
    if (made.status === 201) expect(await smsSettled(phone, ["booking_made_for_you"], 1500)).toBe(0);
    else expect(made.status).toBeGreaterThanOrEqual(400);
  });

  it("a salon booking its own number texts nobody", async () => {
    const salon = await newSalon("Hand Salon Self");
    const made = await salonEntry(salon, { phone: salon.phone, time: "16:00" });
    expect(made.status).toBe(201);
    expect(await smsSettled(salon.phone, ["booking_made_for_you"], 1500)).toBe(0);
  });

  it("a client's own request is not a hand entry: the client gets no «برایت نوبت … ثبت کرد»", async () => {
    const salon = await newSalon("Hand Salon Request");
    const client = await newClient("Hand Request Client");
    const made = await client.api.post("/api/salon-bookings", { salonUserId: salon.id, service: "کوتاهی مو", bookingDate: FAR_DAY(3), time: "13:00", client: client.user.name, phone: client.phone });
    expect(made.status).toBe(201);
    expect(await smsSettled(client.phone, ["booking_made_for_you"], 1500)).toBe(0);
  });
});

describe("a salon deleting its account tells every artist on its team", () => {
  it("each of three team artists gets the «همکاری تموم شد» card and an SMS; nobody else does", async () => {
    const { salon, members } = await teamSalon("Gone Salon", 3);
    const salonName = salon.user.name;
    expect((await deleteMe(salon)).ok).toBe(true);
    for (const artist of members) {
      const texts = await smsEventually(artist.phone, "team_salon_gone", 1);
      expect(texts).toHaveLength(1);
      expect(texts[0].body).toContain(salonName);
      expect(texts[0].body).toContain("حسابش را حذف کرد");
      const cards = await q("SELECT kind, from_name, from_user_id FROM team_notices WHERE user_id = $1", [artist.id]);
      expect(cards).toEqual([{ kind: "gone", from_name: salonName, from_user_id: null }]);
      // the card is what the artist's app shows
      const shown = await artist.api.get("/api/team-notices");
      expect(shown.ok).toBe(true);
      expect(JSON.stringify(shown.payload)).toContain("gone");
      expect(await smsSettled(artist.phone, ["team_salon_gone"])).toBe(1);
    }
    // the salon's own number is not texted about itself
    expect(await smsSettled(salon.phone, ["team_salon_gone"], 300)).toBe(0);
  });

  it("an artist deleting their account does not send the salon «gone» cards", async () => {
    const { salon, members } = await teamSalon("Stay Salon", 1);
    expect((await deleteMe(members[0])).ok).toBe(true);
    expect(await q("SELECT 1 FROM team_notices WHERE user_id = $1 AND kind = 'gone'", [salon.id])).toHaveLength(0);
  });
});
