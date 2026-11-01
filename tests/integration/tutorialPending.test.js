import { describe, it, expect } from "vitest";
import { createClient, registerUser } from "./helpers.js";

// The role's tutorial (owner's decision 2026-11-01): once, right after sign-up; the slides' end clears it for good.

describe("tutorialPending", () => {
  it("a new account has it; ending the slides clears it", async () => {
    for (const type of ["client", "salon", "artist"]) {
      const client = createClient();
      await registerUser(client, { type, name: `Tutorial ${type}` });
      const before = (await client.get("/api/profile/settings")).payload.data.settings;
      expect(before.tutorialPending).toBe(true);
      const ended = await client.post("/api/profile/settings", { settings: { tutorialPending: false } });
      expect(ended.ok).toBe(true);
      expect((await client.get("/api/profile/settings")).payload.data.settings.tutorialPending).toBe(false);
    }
  });
});
