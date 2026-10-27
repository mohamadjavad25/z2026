import { describe, it, expect } from "vitest";
import { createClient, registerUser } from "./helpers.js";

// «اینستاگرام» on salon and artist profiles (owner's choice 2026-10-27).
describe("instagram page on the profile", () => {
  it("a salon saves its page from a pasted link, and its public page carries it", async () => {
    const client = createClient();
    const { user } = await registerUser(client, { type: "salon", name: "سالن اینستا" });
    const saved = await client.post("/api/profile", { data: { instagram: "https://www.instagram.com/Salon.Insta/?igsh=x" } });
    expect(saved.ok).toBe(true);
    expect(saved.payload.data.user.instagram).toBe("salon.insta");

    const me = await client.get("/api/auth/me");
    expect(me.payload.data.user.instagram).toBe("salon.insta");

    const page = await createClient().get(`/api/salons/${user.id}`);
    expect(page.ok).toBe(true);
    expect(JSON.stringify(page.payload)).toContain("\"instagram\":\"salon.insta\"");
  });

  it("an artist removes it with an empty value; a bad name is refused and keeps the old one", async () => {
    const client = createClient();
    const { user } = await registerUser(client, { type: "artist", name: "آرتیست اینستا" });
    await client.post("/api/profile", { data: { instagram: "@artist.insta" } });

    const bad = await client.post("/api/profile", { data: { instagram: "سالن رز" } });
    expect(bad.status).toBe(400);
    expect(bad.payload.code).toBe("instagram_invalid");
    expect((await createClient().get(`/api/artists/${user.id}`)).payload.data.artist.instagram).toBe("artist.insta");

    const removed = await client.post("/api/profile", { data: { instagram: "" } });
    expect(removed.payload.data.user.instagram).toBe("");
    expect((await createClient().get(`/api/artists/${user.id}`)).payload.data.artist.instagram).toBe("");
  });

  it("other profile edits leave the page as it is, and a client cannot set one", async () => {
    const salon = createClient();
    await registerUser(salon, { type: "salon", name: "سالن اینستا دو" });
    await salon.post("/api/profile", { data: { instagram: "salon.two" } });
    const renamed = await salon.post("/api/profile", { data: { area: "تهران" } });
    expect(renamed.payload.data.user.instagram).toBe("salon.two");

    const client = createClient();
    await registerUser(client, { type: "client" });
    const res = await client.post("/api/profile", { data: { instagram: "client.page" } });
    expect(res.ok).toBe(true);
    expect(res.payload.data.user.instagram).toBe("");
  });
});
