import { describe, it, expect } from "vitest";
import { adminClient, createClient, registerUser } from "./helpers.js";
import { q } from "./angle2Util.js";

describe("client error reporting", () => {
  it("accepts a well-formed crash report without auth", async () => {
    const res = await createClient().post("/api/client-errors", { message: "boom", source: "test", url: "/" });
    expect(res.ok).toBe(true);
  });

  it("ties a report to the account from the session, never from what the report says", async () => {
    const person = createClient();
    const { user } = await registerUser(person, { type: "client", name: "گوشی خطادار" });
    const other = createClient();
    const { user: victim } = await registerUser(other, { type: "client", name: "بی‌گناه" });

    expect((await person.post("/api/client-errors", { message: "signed in crash", userId: victim.id, user_id: victim.id })).ok).toBe(true);
    expect((await createClient().post("/api/client-errors", { message: "guest crash", userId: victim.id })).ok).toBe(true);

    expect((await q("SELECT user_id FROM client_errors WHERE message = 'signed in crash'"))[0].user_id).toBe(user.id);
    expect((await q("SELECT user_id FROM client_errors WHERE message = 'guest crash'"))[0].user_id).toBe(null);

    const admin = await adminClient();
    const { groups } = (await admin.get("/api/admin/system")).payload.data.errors;
    expect(groups.find((group) => group.message === "signed in crash")).toMatchObject({ people: 1, last_user_id: user.id, last_user_name: "گوشی خطادار" });
    expect(groups.find((group) => group.message === "guest crash")).toMatchObject({ people: 0, last_user_id: null });
  });

  it("keeps the report but not the link when the account is deleted", async () => {
    const person = createClient();
    const { user } = await registerUser(person, { type: "client", name: "حساب رفته" });
    await person.post("/api/client-errors", { message: "gone account crash" });
    await q("DELETE FROM users WHERE id = $1", [user.id]);
    expect((await q("SELECT user_id FROM client_errors WHERE message = 'gone account crash'"))[0].user_id).toBe(null);
  });

  it("rejects malformed or oversized reports", async () => {
    const client = createClient();
    expect((await client.post("/api/client-errors", { nope: 1 })).status).toBe(400);
    expect((await client.post("/api/client-errors", { message: "x".repeat(501) })).status).toBe(400);
  });
});
