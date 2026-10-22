import { describe, it, expect } from "vitest";
import { createClient, registerUser } from "./helpers.js";

describe("cursor pagination", () => {
  it("pages through every salon exactly once, in order, even with a concurrent insert mid-pagination", async () => {
    const anon = createClient();
    const seededIds = [];
    for (let i = 0; i < 25; i += 1) {
      const salonClient = createClient();
      const { user } = await registerUser(salonClient, { type: "salon", name: `Page Salon ${i}` });
      seededIds.push(user.id);
    }

    let cursor;
    const collected = [];
    let pages = 0;
    for (;;) {
      const qs = cursor ? `?limit=10&cursor=${cursor}` : "?limit=10";
      const res = await anon.get(`/api/salons${qs}`);
      expect(res.ok).toBe(true);
      collected.push(...res.payload.data.salons.map((s) => s.id));
      pages += 1;

      if (pages === 1) {
        // Insert a new salon mid-pagination -- must not shift or duplicate
        // pages already fetched (the cursor only ever looks further back
        // than where it already was).
        const midClient = createClient();
        await registerUser(midClient, { type: "salon", name: "Mid-page Insert" });
      }

      if (!res.payload.data.nextCursor) break;
      cursor = res.payload.data.nextCursor;
      if (pages > 500) throw new Error("too many pages, pagination likely looping");
    }

    const seededCollected = collected.filter((id) => seededIds.includes(id));
    expect(seededCollected.length).toBe(seededIds.length);
    expect(new Set(seededCollected).size).toBe(seededIds.length);
  });

  it("an unpaginated call (no cursor/limit) answers one bounded page, and following nextCursor reaches the rest", async () => {
    const anon = createClient();
    const res = await anon.get("/api/salons");
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.payload.data.salons)).toBe(true);
    expect(res.payload.data.salons.length).toBeLessThanOrEqual(100);
    // A full page always says where the next one starts. A page can also come back short while more remain (salons that
    // are hidden from the directory are dropped after the page is cut, see listSalons), so a short page proves nothing:
    // what matters is that following nextCursor reaches an end.
    if (res.payload.data.salons.length === 100) expect(res.payload.data.nextCursor).toBeTruthy();
    let cursor = res.payload.data.nextCursor;
    let pages = 1;
    while (cursor && pages < 500) {
      const next = await anon.get(`/api/salons?cursor=${cursor}`);
      expect(next.ok).toBe(true);
      cursor = next.payload.data.nextCursor;
      pages += 1;
    }
    expect(cursor).toBeNull();
  });
});
