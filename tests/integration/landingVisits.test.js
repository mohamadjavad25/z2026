import { describe, it, expect } from "vitest";
import pg from "pg";
import { createClient } from "./helpers.js";

const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
const count = async (source) => {
  const { rows } = await db.query("SELECT COALESCE(SUM(n), 0)::int AS n FROM landing_visits WHERE source = $1 AND kind = 'open'", [source]);
  return rows[0].n;
};

describe("reel link counters (/api/landing-visit)", () => {
  it("counts opens per source (cleaned to lower case) and refuses unknown kinds", async () => {
    await db.connect();
    try {
      const client = createClient();
      const before = await count("reeltest");
      expect((await client.post("/api/landing-visit", { source: "ReelTest", kind: "open" })).ok).toBe(true);
      expect((await client.post("/api/landing-visit", { source: "reeltest", kind: "open" })).ok).toBe(true);
      expect((await client.post("/api/landing-visit", { source: "reeltest", kind: "bazaar" })).ok).toBe(true);
      expect((await client.post("/api/landing-visit", { source: "reeltest", kind: "hack" })).status).toBe(400);
      expect((await count("reeltest")) - before).toBe(2);
    } finally {
      await db.end();
    }
  });
});
