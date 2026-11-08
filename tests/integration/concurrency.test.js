import { describe, it, expect } from "vitest";
import { createClient, registerUser } from "./helpers.js";
import { q } from "./exitHelpers.js";

describe("toggle race conditions", () => {
  it("10 truly concurrent follow toggles never throw and leave a consistent final state", async () => {
    const follower = createClient();
    await registerUser(follower, { type: "client", name: "Follower" });
    const targetClient = createClient();
    const target = await registerUser(targetClient, { type: "artist", name: "Followed Artist" });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => follower.post("/api/follows", { targetUserId: target.user.id }))
    );
    // No request should have failed with an unhandled-error 500 from a
    // duplicate-key race (see app/lib/db/repos/social.js's toggleFollow).
    for (const res of results) {
      expect(res.status).not.toBe(500);
    }
  });

  it("10 truly concurrent save toggles never throw and never double-count saves_count", async () => {
    const owner = createClient();
    await registerUser(owner, { type: "artist", name: "Post Owner" });
    const post = await owner.post("/api/posts", { title: "Save race test", tag: "مو", image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" });
    expect(post.ok).toBe(true);

    const saver = createClient();
    await registerUser(saver, { type: "client", name: "Saver" });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => saver.post(`/api/posts/${post.payload.data.post.id}/save`, {}))
    );
    for (const res of results) {
      expect(res.status).not.toBe(500);
    }

    const refreshed = await owner.get("/api/posts");
    const row = refreshed.payload.data.posts.find((p) => p.id === post.payload.data.post.id);
    // saves_count must reflect the true number of post_saves rows (0 or 1
    // for one saver toggling 10 times), never inflated by concurrent
    // increments that ran even when ON CONFLICT DO NOTHING skipped the
    // actual insert -- see the rowCount-gated counter fix in posts.js.
    expect(Number(row.saves)).toBeLessThanOrEqual(1);
  });

  it("10 truly concurrent salon-artist invites for the same pair never throw and leave exactly one pending invite", async () => {
    const salon = createClient();
    await registerUser(salon, { type: "salon", name: "Race Salon" });
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: "Invited Artist" });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => salon.post("/api/salon-invites", { artistUserId: artist.user.id }))
    );
    // No request should have failed with an unhandled-error 500 from a
    // duplicate-key race (see app/lib/db/repos/salons/invites.js's
    // createSalonArtistInvite -- same class of fix as toggleFollow/
    // toggleSave above).
    for (const res of results) {
      expect(res.status).not.toBe(500);
    }
    // Exactly one request should have actually created the invite (201 +
    // created: true); every other concurrent request must see the
    // PENDING_EXISTS branch (400), never a second row.
    const created = results.filter((res) => res.status === 201 && res.payload.data.created === true);
    expect(created.length).toBe(1);

    const invites = await salon.get("/api/salon-invites");
    const matching = invites.payload.data.invites.filter((invite) => Number(invite.artistId) === artist.user.id);
    expect(matching.length).toBe(1);
  });

  it("10 truly concurrent taps of «قبول» on one invite seat the artist once (HEALTH debt 10, 2026-11-08)", async () => {
    const salon = createClient();
    const salonUser = await registerUser(salon, { type: "salon", name: "Accept Race Salon" });
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: "Accept Race Artist" });
    const sent = await salon.post("/api/salon-invites", { artistUserId: artist.user.id });
    expect(sent.status).toBe(201);
    const inviteId = sent.payload.data.invite.id;

    const results = await Promise.all(
      Array.from({ length: 10 }, () => artistClient.patch("/api/artist/invites", { id: inviteId, status: "تایید شد" }))
    );
    for (const res of results) expect(res.status).not.toBe(500);
    // One answer counts; every other tap is told the invite no longer takes an answer.
    expect(results.filter((res) => res.ok)).toHaveLength(1);
    expect(results.filter((res) => !res.ok).every((res) => res.payload.code === "NOT_PENDING")).toBe(true);
    const seats = await q("SELECT id FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2", [salonUser.user.id, artist.user.id]);
    expect(seats).toHaveLength(1);
  });

  it("accepting and declining the same invite at once leaves one answer that matches the team", async () => {
    const salon = createClient();
    const salonUser = await registerUser(salon, { type: "salon", name: "Mixed Answer Salon" });
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: "Mixed Answer Artist" });
    const sent = await salon.post("/api/salon-invites", { artistUserId: artist.user.id });
    const inviteId = sent.payload.data.invite.id;

    const results = await Promise.all([
      artistClient.patch("/api/artist/invites", { id: inviteId, status: "تایید شد" }),
      artistClient.patch("/api/artist/invites", { id: inviteId, status: "رد شد" })
    ]);
    expect(results.filter((res) => res.ok)).toHaveLength(1);
    const [invite] = await q("SELECT status FROM salon_artist_invites WHERE id = $1", [inviteId]);
    const seats = await q("SELECT id FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2", [salonUser.user.id, artist.user.id]);
    expect(seats).toHaveLength(invite.status === "تایید شد" ? 1 : 0);
  });
});
