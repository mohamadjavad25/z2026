import { describe, it, expect } from "vitest";
import { createClient, registerUser } from "./helpers.js";

// Client <-> salon/artist "connect" (the client's «سالن و آرتیست من» list).

async function newClient() {
  const api = createClient();
  const account = await registerUser(api, { type: "client", name: "مشتری اتصال" });
  return { api, ...account };
}

async function newProfile(type, name) {
  const api = createClient();
  const account = await registerUser(api, { type, name });
  return { api, ...account };
}

describe("client connections", () => {
  it("finds a salon by its owner's phone (any digit style) and connects once", async () => {
    const client = await newClient();
    const salon = await newProfile("salon", `سالن اتصال ${Date.now()}`);
    const persianPhone = salon.phone.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);

    const found = await client.api.get(`/api/connections/search?q=${encodeURIComponent(persianPhone)}`);
    expect(found.ok).toBe(true);
    expect(found.payload.data.by).toBe("phone");
    expect(found.payload.data.results.map((r) => r.id)).toEqual([salon.user.id]);
    expect(found.payload.data.results[0].connected).toBe(false);

    const first = await client.api.post("/api/connections", { targetUserId: salon.user.id });
    expect(first.ok).toBe(true);
    expect(first.payload.data.alreadyConnected).toBe(false);
    const again = await client.api.post("/api/connections", { targetUserId: salon.user.id });
    expect(again.payload.data.alreadyConnected).toBe(true);

    const list = await client.api.get("/api/connections");
    expect(list.payload.data.connections.map((c) => c.id)).toEqual([salon.user.id]);
    expect(list.payload.data.connections[0].type).toBe("salon");

    const after = await client.api.get(`/api/connections/search?q=${salon.phone}`);
    expect(after.payload.data.results[0].connected).toBe(true);
  });

  it("finds by public page link and by name, and can disconnect", async () => {
    const client = await newClient();
    const artist = await newProfile("artist", `آرتیست یكتا ${Date.now()}`);

    const byLink = await client.api.get(`/api/connections/search?q=${encodeURIComponent(`https://frfro.example/artists/${artist.user.id}`)}`);
    expect(byLink.payload.data.by).toBe("link");
    expect(byLink.payload.data.results[0].id).toBe(artist.user.id);

    // Arabic kaf/yeh in the stored name still match the Persian letters typed.
    const byName = await client.api.get(`/api/connections/search?q=${encodeURIComponent("آرتیست یکتا")}`);
    expect(byName.payload.data.by).toBe("name");
    expect(byName.payload.data.results.map((r) => r.id)).toContain(artist.user.id);

    await client.api.post("/api/connections", { targetUserId: artist.user.id });
    const removed = await client.api.delete("/api/connections", { targetUserId: artist.user.id });
    expect(removed.payload.data.removed).toBe(true);
    const list = await client.api.get("/api/connections");
    expect(list.payload.data.connections).toEqual([]);
  });

  it("does not connect to clients or unknown ids, and is client-only", async () => {
    const client = await newClient();
    const other = await newClient();
    const toClient = await client.api.post("/api/connections", { targetUserId: other.user.id });
    expect(toClient.status).toBe(404);
    const unknown = await client.api.post("/api/connections", { targetUserId: 99999999 });
    expect(unknown.status).toBe(404);

    const salon = await newProfile("salon", "سالن نقش");
    const salonList = await salon.api.get("/api/connections");
    expect(salonList.status).toBe(403);
  });

  it("a salon scanning the client's personal code connects them; a forged code does not", async () => {
    const client = await newClient();
    const salon = await newProfile("salon", `سالن اسکن ${Date.now()}`);

    const codeRes = await client.api.get("/api/connections/code");
    const code = codeRes.payload.data.code;
    expect(code).toMatch(/^FRFRO-C1:\d+:[A-Za-z0-9]{12}$/);
    // stable across calls
    expect((await client.api.get("/api/connections/code")).payload.data.code).toBe(code);
    // never exposed through the settings API
    const settings = await client.api.get("/api/profile/settings");
    expect(JSON.stringify(settings.payload)).not.toContain(code.split(":")[2]);

    const forged = await salon.api.post("/api/connections/scan", { code: `FRFRO-C1:${client.user.id}:AAAAAAAAAAAA` });
    expect(forged.ok).toBe(false);

    const scanned = await salon.api.post("/api/connections/scan", { code });
    expect(scanned.ok).toBe(true);
    expect(scanned.payload.data.client.id).toBe(client.user.id);
    expect(scanned.payload.data.alreadyConnected).toBe(false);

    const list = await client.api.get("/api/connections");
    expect(list.payload.data.connections.map((c) => c.id)).toContain(salon.user.id);

    // clients cannot use the scan endpoint
    const other = await newClient();
    const byClient = await other.api.post("/api/connections/scan", { code });
    expect(byClient.status).toBe(403);
  });
});

describe("scan lookup between salons, artists and clients", () => {
  it("tells each viewer how they relate to a scanned profile", async () => {
    const salon = await newProfile("salon", `سالن تیم ${Date.now()}`);
    const artist = await newProfile("artist", `آرتیست تیم ${Date.now()}`);
    const client = await newClient();
    const lookup = (who, code) => who.api.get(`/api/connections/lookup?code=${encodeURIComponent(code)}`);

    // salon scans the artist's profile QR: not related yet, then invited after the existing invite call
    const before = await lookup(salon, `https://x.example/artists/${artist.user.id}`);
    expect(before.ok).toBe(true);
    expect(before.payload.data.profile.id).toBe(artist.user.id);
    expect(before.payload.data.relation).toBe("none");
    expect((await salon.api.post("/api/salon-invites", { artistUserId: artist.user.id })).status).toBe(201);
    expect((await lookup(salon, `/artists/${artist.user.id}`)).payload.data.relation).toBe("invited");

    // artist scans the salon's team link and joins: now a member from both sides
    expect((await lookup(artist, `https://x.example/join-salon/${salon.user.id}`)).payload.data.relation).toBe("none");
    expect((await artist.api.post("/api/artist/join-salon", { salonUserId: salon.user.id })).status).toBe(201);
    expect((await lookup(artist, `/salons/${salon.user.id}`)).payload.data.relation).toBe("member");
    expect((await lookup(salon, `/artists/${artist.user.id}`)).payload.data.relation).toBe("member");

    // a client sees a plain connect relation; same-type scans and own code are flagged
    expect((await lookup(client, `/salons/${salon.user.id}`)).payload.data.relation).toBe("none");
    const otherSalon = await newProfile("salon", "سالن دیگر");
    expect((await lookup(otherSalon, `/salons/${salon.user.id}`)).payload.data.relation).toBe("unrelated");
    expect((await lookup(salon, `/salons/${salon.user.id}`)).payload.data.relation).toBe("self");

    // junk and unknown ids
    expect((await lookup(client, "hello")).status).toBe(400);
    expect((await lookup(client, "/artists/99999999")).status).toBe(404);
  });
});
