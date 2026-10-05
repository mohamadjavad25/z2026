import { describe, it, expect } from "vitest";
import { createClient } from "./helpers.js";

describe("client error reporting", () => {
  it("accepts a well-formed crash report without auth", async () => {
    const res = await createClient().post("/api/client-errors", { message: "boom", source: "test", url: "/" });
    expect(res.ok).toBe(true);
  });

  it("rejects malformed or oversized reports", async () => {
    const client = createClient();
    expect((await client.post("/api/client-errors", { nope: 1 })).status).toBe(400);
    expect((await client.post("/api/client-errors", { message: "x".repeat(501) })).status).toBe(400);
  });
});
