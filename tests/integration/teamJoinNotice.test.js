import { describe, it, expect } from "vitest";
import { DEFAULT_JOIN_TERMS, ensureJoinTerms } from "./helpers.js";
import { joinSalonAsArtist, newArtist, newSalon, q, smsEventually, smsSettled } from "./exitHelpers.js";

/**
 * Owner's decision of 2026-11-04: an artist coming into a salon's team is told to the side that did not tap, the way an
 * end of a team is: the «اومد توی تیمت» card until «باشه», a push, and an SMS when the push missed their app (tests have
 * no app push, so the SMS goes). Before, only a push went, and the owner's salon (no push device yet) heard nothing.
 */
const cardsOf = async (who) => (await who.api.get("/api/team-notices")).payload.data.notices;

describe("an artist coming into a salon's team is told to the other side", () => {
  it("joining with the salon's code: the salon gets the card and one SMS, the artist gets nothing", async () => {
    const salon = await newSalon("Join Card Salon");
    const artist = await newArtist("Join Card Artist");
    expect((await joinSalonAsArtist(artist.api, salon.api, salon.id)).status).toBe(201);

    const texts = await smsEventually(salon.phone, "team_joined", 1);
    expect(texts).toHaveLength(1);
    expect(texts[0].body).toContain(artist.user.name);
    const cards = await cardsOf(salon);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ kind: "joined", fromName: artist.user.name });

    expect(await cardsOf(artist)).toHaveLength(0);
    expect(await smsSettled(artist.phone, ["team_joined", "team_accepted"], 300)).toBe(0);
    expect(await smsSettled(salon.phone, ["team_joined"])).toBe(1);

    // «باشه» closes it for good.
    expect((await salon.api.post("/api/team-notices", { ids: [cards[0].id] })).ok).toBe(true);
    expect(await cardsOf(salon)).toHaveLength(0);
  });

  it("accepting the salon's invite tells the salon", async () => {
    const salon = await newSalon("Invite Card Salon");
    const artist = await newArtist("Invite Card Artist");
    const sent = await salon.api.post("/api/salon-invites", { artistUserId: artist.id });
    expect(sent.status).toBe(201);
    const accepted = await artist.api.patch("/api/artist/invites", { id: sent.payload.data.invite.id, status: "تایید شد" });
    expect(accepted.ok).toBe(true);
    expect(await smsEventually(salon.phone, "team_joined", 1)).toHaveLength(1);
    expect((await cardsOf(salon))[0]).toMatchObject({ kind: "joined", fromName: artist.user.name });
    expect(await cardsOf(artist)).toHaveLength(0);
  });

  it("saying no to the invite sends no card and no SMS", async () => {
    const salon = await newSalon("Invite No Salon");
    const artist = await newArtist("Invite No Artist");
    const sent = await salon.api.post("/api/salon-invites", { artistUserId: artist.id });
    expect((await artist.api.patch("/api/artist/invites", { id: sent.payload.data.invite.id, status: "رد شد" })).ok).toBe(true);
    expect(await smsSettled(salon.phone, ["team_joined"])).toBe(0);
    expect(await cardsOf(salon)).toHaveLength(0);
  });

  it("the salon accepting the artist's request tells the artist, not the salon", async () => {
    const salon = await newSalon("Request Card Salon");
    const { version } = await ensureJoinTerms(salon.api);
    const code = (await salon.api.get("/api/salon-invites/join-code")).payload.data.code;
    const artist = await newArtist("Request Card Artist");
    const asked = await artist.api.post("/api/artist/join-proposal", { salonUserId: salon.id, code, termsVersion: version, ...DEFAULT_JOIN_TERMS, share: 60, note: "" });
    expect(asked.status).toBe(201);
    const id = (await salon.api.get("/api/salon-collabs")).payload.data.collabs[0].id;
    expect((await salon.api.patch("/api/salon-collabs", { id, action: "accept" })).status).toBe(200);

    const texts = await smsEventually(artist.phone, "team_accepted", 1);
    expect(texts).toHaveLength(1);
    expect(texts[0].body).toContain(salon.user.name);
    expect((await cardsOf(artist))[0]).toMatchObject({ kind: "accepted", fromName: salon.user.name });
    expect(await cardsOf(salon)).toHaveLength(0);
    expect(await smsSettled(salon.phone, ["team_joined", "team_accepted"], 300)).toBe(0);
    expect(await q("SELECT 1 FROM team_notices WHERE user_id = $1", [salon.id])).toHaveLength(0);
  });
});
