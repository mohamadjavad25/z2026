import { describe, it, expect } from "vitest";
import { createClient, registerUser } from "./helpers.js";

async function setup() {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", name: "Link Salon" });
  const artistClient = createClient();
  const artist = await registerUser(artistClient, { type: "artist", name: "Link Artist" });
  return { salonClient, salon, artistClient, artist };
}

const TERMS = { service: "رنگ و لایت", days: "شنبه، دوشنبه", from: "۱۰:۰۰", to: "۱۸:۰۰", share: "۵۰", capacity: "۴" };

async function staffOf(salonClient) {
  const res = await salonClient.get("/api/salon-staff");
  return res.payload.data.staff;
}

describe("salon <-> artist connection", () => {
  it("invite path: salon invites with terms, artist accepts, artist becomes staff", async () => {
    const { salonClient, artistClient, artist } = await setup();
    const sent = await salonClient.post("/api/salon-invites", {
      artistUserId: artist.user.id, role: "رنگ و لایت", days: TERMS.days, from: TERMS.from, to: TERMS.to, share: TERMS.share, capacity: TERMS.capacity
    });
    expect(sent.status).toBe(201);
    expect(sent.payload.data.invite.status).toBe("در انتظار تایید");

    // a second invite while the first is pending is refused
    const dup = await salonClient.post("/api/salon-invites", { artistUserId: artist.user.id });
    expect(dup.ok).toBe(false);
    expect(dup.payload.code).toBe("PENDING_EXISTS");

    const inbox = await artistClient.get("/api/artist/invites");
    expect(inbox.payload.data.pendingCount).toBe(1);
    const accepted = await artistClient.patch("/api/artist/invites", { id: sent.payload.data.invite.id, status: "تایید شد" });
    expect(accepted.ok).toBe(true);

    const staff = await staffOf(salonClient);
    expect(staff.map((p) => p.artist_user_id)).toContain(artist.user.id);

    // answering twice is refused
    const again = await artistClient.patch("/api/artist/invites", { id: sent.payload.data.invite.id, status: "رد شد" });
    expect(again.ok).toBe(false);
  });

  it("proposal path: artist proposes, salon accepts, artist becomes staff; the status cannot be forged", async () => {
    const { salonClient, salon, artistClient, artist } = await setup();
    const sent = await artistClient.post("/api/artist/me", { kind: "collab", salonId: salon.user.id, ...TERMS, status: "تایید شد" });
    expect(sent.status).toBe(201);
    // the client-supplied status is ignored: it starts pending, and no staff row exists yet
    expect(sent.payload.data.collab.status).toBe("آماده ارسال");
    expect(await staffOf(salonClient)).toEqual([]);

    const dup = await artistClient.post("/api/artist/me", { kind: "collab", salonId: salon.user.id, ...TERMS });
    expect(dup.payload.code).toBe("PENDING_EXISTS");

    const collabs = await salonClient.get("/api/salon-collabs");
    const id = collabs.payload.data.collabs[0].id;
    const accepted = await salonClient.patch("/api/salon-collabs", { id, status: "تایید شد" });
    expect(accepted.ok).toBe(true);
    expect((await staffOf(salonClient)).map((p) => p.artist_user_id)).toContain(artist.user.id);

    // a finished decision cannot be flipped
    const flip = await salonClient.patch("/api/salon-collabs", { id, status: "رد شد" });
    expect(flip.status).toBe(409);

    // already a member -> a new proposal is refused
    const member = await artistClient.post("/api/artist/me", { kind: "collab", salonId: salon.user.id, ...TERMS });
    expect(member.payload.code).toBe("ALREADY_STAFF");
  });

  it("rejects proposals to something that is not a salon", async () => {
    const { artistClient, artist } = await setup();
    const res = await artistClient.post("/api/artist/me", { kind: "collab", salonId: artist.user.id, ...TERMS });
    expect(res.status).toBe(404);
    expect(res.payload.code).toBe("SALON_NOT_FOUND");
  });

  it("the invite and proposal doors check each other", async () => {
    const a = await setup();
    await a.artistClient.post("/api/artist/me", { kind: "collab", salonId: a.salon.user.id, ...TERMS });
    const invite = await a.salonClient.post("/api/salon-invites", { artistUserId: a.artist.user.id });
    expect(invite.payload.code).toBe("PROPOSAL_PENDING");

    const b = await setup();
    await b.salonClient.post("/api/salon-invites", { artistUserId: b.artist.user.id });
    const proposal = await b.artistClient.post("/api/artist/me", { kind: "collab", salonId: b.salon.user.id, ...TERMS });
    expect(proposal.payload.code).toBe("INVITE_PENDING");
  });

  it("QR path: joining makes the artist staff right away and answers a pending proposal", async () => {
    const { salonClient, salon, artistClient, artist } = await setup();
    await artistClient.post("/api/artist/me", { kind: "collab", salonId: salon.user.id, ...TERMS });
    const joined = await artistClient.post("/api/artist/join-salon", { salonUserId: salon.user.id });
    expect(joined.status).toBe(201);
    expect((await staffOf(salonClient)).map((p) => p.artist_user_id)).toContain(artist.user.id);

    const collabs = await salonClient.get("/api/salon-collabs");
    expect(collabs.payload.data.collabs[0].status).toBe("تایید شد");

    const again = await artistClient.post("/api/artist/join-salon", { salonUserId: salon.user.id });
    expect(again.ok).toBe(false);
    expect(again.payload.code).toBe("ALREADY_STAFF");
  });

  it("clients cannot use the salon/artist connection endpoints", async () => {
    const { salon } = await setup();
    const clientClient = createClient();
    await registerUser(clientClient, { type: "client", name: "Plain Client" });
    expect((await clientClient.post("/api/artist/join-salon", { salonUserId: salon.user.id })).ok).toBe(false);
    expect((await clientClient.post("/api/artist/me", { kind: "collab", salonId: salon.user.id })).ok).toBe(false);
    expect((await clientClient.get("/api/salon-collabs")).ok).toBe(false);
  });
});

describe("teams: membership, leaving and reconnecting", () => {
  it("lists the artist's teams with the agreed terms, and the artist can leave and be re-invited", async () => {
    const { salonClient, salon, artistClient, artist } = await setup();
    const sent = await salonClient.post("/api/salon-invites", {
      artistUserId: artist.user.id, role: "رنگ و لایت", days: TERMS.days, from: TERMS.from, to: TERMS.to, share: TERMS.share, capacity: TERMS.capacity
    });
    await artistClient.patch("/api/artist/invites", { id: sent.payload.data.invite.id, status: "تایید شد" });

    const teams = await artistClient.get("/api/artist/teams");
    expect(teams.payload.data.teams).toHaveLength(1);
    expect(teams.payload.data.teams[0]).toMatchObject({ salonId: salon.user.id, share: TERMS.share, days: TERMS.days });

    const left = await artistClient.delete("/api/artist/teams", { salonUserId: salon.user.id });
    expect(left.ok).toBe(true);
    expect(left.payload.data.teams).toEqual([]);
    expect(await staffOf(salonClient)).toEqual([]);

    // leaving twice is refused
    const twice = await artistClient.delete("/api/artist/teams", { salonUserId: salon.user.id });
    expect(twice.status).toBe(404);

    // the pair can reconnect: the earlier accepted invite no longer blocks a new one
    const again = await salonClient.post("/api/salon-invites", { artistUserId: artist.user.id });
    expect(again.status).toBe(201);
  });

  it("a salon removing a member also lets it invite that artist again", async () => {
    const { salonClient, artistClient, artist } = await setup();
    const sent = await salonClient.post("/api/salon-invites", { artistUserId: artist.user.id });
    await artistClient.patch("/api/artist/invites", { id: sent.payload.data.invite.id, status: "تایید شد" });
    const [member] = await staffOf(salonClient);
    const removed = await salonClient.delete("/api/salon-staff", { id: member.id });
    expect(removed.ok).toBe(true);
    const again = await salonClient.post("/api/salon-invites", { artistUserId: artist.user.id });
    expect(again.status).toBe(201);
  });
});
