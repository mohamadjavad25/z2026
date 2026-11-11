import { describe, it, expect } from "vitest";
import pg from "pg";
import { adminClient, createClient, registerUser } from "./helpers.js";

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

describe("what the links brought (admin reports)", () => {
  it("shows today's opens split by link, the taps on the start button and the day's new salons and artists", async () => {
    const admin = await adminClient();
    const today = async () => {
      const res = await admin.get("/api/admin/reports?days=7");
      expect(res.ok).toBe(true);
      const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date());
      return res.payload.data.links.find((row) => row.day === key) || { opened: 0, started: 0, salons: 0, artists: 0, sources: [] };
    };
    const before = await today();
    const visitor = createClient();
    for (const [source, kind] of [["sms-a", "open"], ["sms-a", "open"], ["sms-b", "open"], ["sms-a", "enter"]]) {
      expect((await visitor.post("/api/landing-visit", { source, kind })).ok).toBe(true);
    }
    await registerUser(createClient(), { type: "salon", name: "Link Result Salon" });
    const after = await today();
    expect(after.opened - before.opened).toBe(3);
    expect(after.started - before.started).toBe(1);
    expect(after.salons - before.salons).toBe(1);
    expect(after.artists).toBe(before.artists);
    const opensOf = (row, source) => row.sources.find((item) => item.source === source)?.opened || 0;
    expect(opensOf(after, "sms-a") - opensOf(before, "sms-a")).toBe(2);
    expect(opensOf(after, "sms-b") - opensOf(before, "sms-b")).toBe(1);
  });

  it("is for admins only", async () => {
    expect((await createClient().get("/api/admin/reports?days=7")).ok).toBe(false);
  });
});
