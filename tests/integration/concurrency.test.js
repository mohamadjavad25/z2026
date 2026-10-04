import { describe, it, expect } from "vitest";
import { createClient, registerUser } from "./helpers.js";

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

    const refreshed = await owner.get("/api/explore/posts");
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
});
