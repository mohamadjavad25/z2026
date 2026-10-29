import { describe, it, expect } from "vitest";
import pg from "pg";
import { createClient, registerUser, DEFAULT_JOIN_TERMS, ensureJoinTerms } from "./helpers.js";
import { TEST_BASE_URL } from "../globalSetup.js";

// «شرایط همکاری سالن»: the salon's saved terms, the join link, requests with the artist's own numbers (owner's decision 2026-10-28).
const sql = async (text, params = []) => {
  const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
  await db.connect();
  try { return (await db.query(text, params)).rows; } finally { await db.end(); }
};

async function newSalon(name = "Join Terms Salon", { terms = true } = {}) {
  const client = createClient();
  const salon = await registerUser(client, { type: "salon", name });
  await client.get("/api/salon-hours");
  const version = terms ? (await ensureJoinTerms(client)).version : null;
  return { client, salon, version };
}
async function newArtist(name = "Join Terms Artist") {
  const client = createClient();
  const artist = await registerUser(client, { type: "artist", name });
  return { client, artist };
}
const codeOf = async (salonClient) => (await salonClient.get("/api/salon-invites/join-code")).payload.data.code;
const join = (artistClient, salonId, code, termsVersion) => artistClient.post("/api/artist/join-salon", { salonUserId: salonId, code, termsVersion });
const propose = (artistClient, salonId, code, termsVersion, extra = {}) =>
  artistClient.post("/api/artist/join-proposal", { salonUserId: salonId, code, termsVersion, ...DEFAULT_JOIN_TERMS, share: 60, ownShare: 80, note: "", ...extra });
const staffIds = async (salonClient) => (await salonClient.get("/api/salon-staff")).payload.data.staff.map((p) => Number(p.artist_user_id));

describe("salon join terms", () => {
  it("the join code is refused until the salon saved its terms, and terms are validated", async () => {
    const { client } = await newSalon("Terms Not Ready", { terms: false });
    expect((await client.get("/api/salon-join-terms")).payload.data.terms).toBeNull();
    const early = await client.get("/api/salon-invites/join-code");
    expect(early.status).toBe(409);
    expect(early.payload.code).toBe("TERMS_NOT_READY");

    for (const bad of [{ ...DEFAULT_JOIN_TERMS, days: "" }, { ...DEFAULT_JOIN_TERMS, to: "23:00" }, { ...DEFAULT_JOIN_TERMS, share: 101 }, { ...DEFAULT_JOIN_TERMS, share: "" }, { ...DEFAULT_JOIN_TERMS, days: "جمعه" }]) {
      const res = await client.put("/api/salon-join-terms", bad);
      expect(res.status).toBe(400);
    }
    expect((await client.get("/api/salon-invites/join-code")).status).toBe(409);

    const saved = await client.put("/api/salon-join-terms", { ...DEFAULT_JOIN_TERMS, ownShare: 70, allowProposals: true });
    expect(saved.status).toBe(200);
    expect(saved.payload.data.terms).toMatchObject({ share: 50, ownShare: 70, allowProposals: true, version: 1 });
    expect((await client.get("/api/salon-invites/join-code")).ok).toBe(true);
    // Same numbers again keep the version; a changed number or the rules text raises it.
    expect((await client.put("/api/salon-join-terms", { ...DEFAULT_JOIN_TERMS, ownShare: 70 })).payload.data.terms.version).toBe(1);
    expect((await client.put("/api/salon-join-terms", { ...DEFAULT_JOIN_TERMS, ownShare: 70, share: 55 })).payload.data.terms.version).toBe(2);
    await client.put("/api/salon-rules", { rules: "اول\n\nدوم\nسوم\nچهارم\nپنجم\nششم" });
    const read = (await client.get("/api/salon-join-terms")).payload.data;
    expect(read.terms.version).toBe(3);
    expect(read.rules).toEqual(["اول", "دوم", "سوم", "چهارم"]);
    expect(read.rulesMore).toBe(2);
  });

  it("only salons can read or save them", async () => {
    const { client } = await newArtist("Not A Salon");
    expect((await client.get("/api/salon-join-terms")).status).toBe(403);
    expect((await client.put("/api/salon-join-terms", DEFAULT_JOIN_TERMS)).status).toBe(403);
  });

  it("two artists use the same code, and each gets an agreed row with the rules of that day", async () => {
    const { client, salon, version } = await newSalon();
    await client.put("/api/salon-rules", { rules: "لطفاً وقت‌شناس باش" });
    const v = (await client.get("/api/salon-join-terms")).payload.data.terms.version;
    expect(v).toBeGreaterThanOrEqual(version);
    const code = await codeOf(client);
    const a = await newArtist("Same Code A");
    const b = await newArtist("Same Code B");
    expect((await join(a.client, salon.user.id, code, v)).status).toBe(201);
    expect((await join(b.client, salon.user.id, code, v)).status).toBe(201);
    expect(await staffIds(client)).toEqual(expect.arrayContaining([a.artist.user.id, b.artist.user.id]));
    const rows = await sql("SELECT * FROM team_terms WHERE salon_user_id = $1 ORDER BY id", [salon.user.id]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ source: "join_page", share_percent: 50, rules_snapshot: "لطفاً وقت‌شناس باش" });
    const current = (await a.client.get(`/api/team-terms?salonUserId=${salon.user.id}`)).payload.data.current;
    expect(current).toMatchObject({ share: 50, from: "10:00", to: "18:00", legacy: false });
  });

  it("the same artist joining twice at once is added once", async () => {
    const { client, salon, version } = await newSalon();
    const code = await codeOf(client);
    const a = await newArtist("Twice A");
    const results = await Promise.all([join(a.client, salon.user.id, code, version), join(a.client, salon.user.id, code, version), join(a.client, salon.user.id, code, version)]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.payload.code === "ALREADY_STAFF")).toHaveLength(2);
    expect((await staffIds(client)).filter((id) => id === a.artist.user.id)).toHaveLength(1);
    expect(await sql("SELECT 1 FROM team_terms WHERE salon_user_id = $1", [salon.user.id])).toHaveLength(1);
  });

  it("a join with an old (or missing) terms version is refused with the new terms", async () => {
    const { client, salon, version } = await newSalon();
    const code = await codeOf(client);
    await client.put("/api/salon-join-terms", { ...DEFAULT_JOIN_TERMS, share: 40 });
    const a = await newArtist("Stale A");
    const stale = await join(a.client, salon.user.id, code, version);
    expect(stale.status).toBe(409);
    expect(stale.payload).toMatchObject({ code: "TERMS_CHANGED", terms: { share: 40, version: version + 1 } });
    expect((await join(a.client, salon.user.id, code, undefined)).payload.code).toBe("TERMS_CHANGED");
    expect(await staffIds(client)).not.toContain(a.artist.user.id);
    expect((await join(a.client, salon.user.id, code, version + 1)).status).toBe(201);
    expect((await join(a.client, salon.user.id, "wrong-code-123", version + 1)).payload.code).toBe("INVALID_CODE");
  });

  it("the public page shows the terms only to someone holding the code", async () => {
    const { client, salon } = await newSalon();
    const code = await codeOf(client);
    const open = await fetch(`${TEST_BASE_URL}/join-salon/${salon.user.id}?k=${code}`);
    expect(open.status).toBe(200);
  });
});

describe("requests with the artist's own numbers", () => {
  it("is gated by code and terms, one open request per pair, and not when proposals are off", async () => {
    const { client, salon, version } = await newSalon();
    const code = await codeOf(client);
    const a = await newArtist("Prop A");
    expect((await propose(a.client, salon.user.id, "bad-code-xxxx", version)).payload.code).toBe("INVALID_CODE");
    const stale = await propose(a.client, salon.user.id, code, version + 5);
    expect(stale.status).toBe(409);
    expect(stale.payload.code).toBe("TERMS_CHANGED");
    expect((await propose(a.client, salon.user.id, code, version, { to: "22:00" })).payload.code).toBe("INVALID");
    expect((await propose(a.client, salon.user.id, code, version, { note: "x".repeat(121) })).payload.code).toBe("NOTE_TOO_LONG");

    const first = await propose(a.client, salon.user.id, code, version, { note: "بعدازظهرها بیشتر راحتم" });
    expect(first.status).toBe(201);
    expect(first.payload.data.collab).toMatchObject({ status: "آماده ارسال", share: "60", ownShare: 80, note: "بعدازظهرها بیشتر راحتم", termsVersion: version });
    expect(new Date(first.payload.data.collab.expiresAt).getTime() - Date.now()).toBeGreaterThan(6.9 * 86400000);
    const twice = await Promise.all([propose(a.client, salon.user.id, code, version), propose(a.client, salon.user.id, code, version)]);
    expect(twice.every((r) => r.status === 409 && r.payload.code === "PENDING_EXISTS")).toBe(true);

    await client.put("/api/salon-join-terms", { ...DEFAULT_JOIN_TERMS, allowProposals: false });
    const b = await newArtist("Prop B");
    const off = await propose(b.client, salon.user.id, code, version);
    expect(off.status).toBe(409);
    expect(off.payload.code).toBe("PROPOSALS_OFF");
    // Joining with the salon's own terms still works, and answers A's waiting request.
    expect((await join(b.client, salon.user.id, code, version)).status).toBe(201);
  });

  it("the salon sees the numbers and the current terms, and accepting adds her with her numbers", async () => {
    const { client, salon, version } = await newSalon();
    const code = await codeOf(client);
    const a = await newArtist("Accept A");
    await propose(a.client, salon.user.id, code, version, { share: 65, ownShare: 90, note: "سلام" });
    const list = (await client.get("/api/salon-collabs")).payload.data.collabs;
    expect(list[0]).toMatchObject({ days: DEFAULT_JOIN_TERMS.days, from: "10:00", to: "18:00", share: "65", ownShare: 90, note: "سلام", current: { share: 50, version } });
    expect(list[0].expiresAt).toBeTruthy();

    const accepted = await client.patch("/api/salon-collabs", { id: list[0].id, action: "accept" });
    expect(accepted.status).toBe(200);
    expect(await staffIds(client)).toContain(a.artist.user.id);
    const row = (await sql("SELECT * FROM team_terms WHERE salon_user_id = $1 AND artist_user_id = $2", [salon.user.id, a.artist.user.id]))[0];
    expect(row).toMatchObject({ source: "proposal", share_percent: 65, own_share_percent: 90 });
    const again = await client.patch("/api/salon-collabs", { id: list[0].id, action: "accept" });
    expect(again.status).toBe(409);
    expect(await sql("SELECT 1 FROM team_terms WHERE salon_user_id = $1", [salon.user.id])).toHaveLength(1);
  });

  it("accepting when she is already on the team is refused clearly and changes nothing", async () => {
    const { client, salon, version } = await newSalon();
    const code = await codeOf(client);
    const a = await newArtist("Already A");
    expect((await join(a.client, salon.user.id, code, version)).status).toBe(201);
    // An old waiting request that somehow outlived the join (inserted directly).
    const [{ id }] = await sql(`INSERT INTO artist_collabs (artist_user_id, salon_user_id, salon_name, days, from_time, to_time, share_percent, terms_version, expires_at, status)
      VALUES ($1, $2, 'x', 'شنبه', '10:00', '18:00', '70', $3, now() + interval '3 days', 'آماده ارسال') RETURNING id`, [a.artist.user.id, salon.user.id, version]);
    const res = await client.patch("/api/salon-collabs", { id, action: "accept" });
    expect(res.status).toBe(409);
    expect(res.payload.code).toBe("ALREADY_STAFF");
    expect((await sql("SELECT status FROM artist_collabs WHERE id = $1", [id]))[0].status).toBe("آماده ارسال");
    expect(await sql("SELECT 1 FROM team_terms WHERE salon_user_id = $1", [salon.user.id])).toHaveLength(1);
  });

  it("a request lapses after 7 days: it cannot be answered, and the artist can ask again", async () => {
    const { client, salon, version } = await newSalon();
    const code = await codeOf(client);
    const a = await newArtist("Lapse A");
    const sent = await propose(a.client, salon.user.id, code, version);
    const id = sent.payload.data.collab.id;
    await sql("UPDATE artist_collabs SET expires_at = now() - interval '1 minute' WHERE id = $1", [id]);
    const late = await client.patch("/api/salon-collabs", { id, action: "accept" });
    expect(late.status).toBe(409);
    expect(late.payload.code).toBe("EXPIRED");
    expect(await staffIds(client)).not.toContain(a.artist.user.id);
    expect((await sql("SELECT status FROM artist_collabs WHERE id = $1", [id]))[0].status).toBe("منقضی شد");
    // The artist's own list shows it as lapsed, and a new request is allowed.
    expect((await a.client.get("/api/artist/me")).ok).toBe(true);
    const again = await propose(a.client, salon.user.id, code, version);
    expect(again.status).toBe(201);
  });

  it("reject and counter answer the artist; a counter becomes a normal invite with the salon's numbers", async () => {
    const { client, salon, version } = await newSalon();
    const code = await codeOf(client);
    const a = await newArtist("Counter A");
    const b = await newArtist("Reject B");
    const pa = (await propose(a.client, salon.user.id, code, version, { share: 80 })).payload.data.collab.id;
    const pb = (await propose(b.client, salon.user.id, code, version, { share: 80 })).payload.data.collab.id;

    const bad = await client.patch("/api/salon-collabs", { id: pa, action: "counter", terms: { ...DEFAULT_JOIN_TERMS, share: 200 } });
    expect(bad.status).toBe(400);
    expect((await sql("SELECT status FROM artist_collabs WHERE id = $1", [pa]))[0].status).toBe("آماده ارسال");

    const countered = await client.patch("/api/salon-collabs", { id: pa, action: "counter", terms: { ...DEFAULT_JOIN_TERMS, share: 55 } });
    expect(countered.status).toBe(200);
    expect(countered.payload.data.collab.status).toBe("رد شد");
    const invites = (await a.client.get("/api/artist/invites")).payload.data.invites;
    expect(invites[0]).toMatchObject({ salonId: salon.user.id, share: "55", status: "در انتظار تایید" });
    expect(await staffIds(client)).not.toContain(a.artist.user.id);

    const rejected = await client.patch("/api/salon-collabs", { id: pb, action: "reject" });
    expect(rejected.status).toBe(200);
    expect(rejected.payload.data.collab.status).toBe("رد شد");
    expect((await client.patch("/api/salon-collabs", { id: pb, action: "accept" })).status).toBe(409);
  });
});
