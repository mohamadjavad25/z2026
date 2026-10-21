import { describe, it, expect } from "vitest";
import { createClient, registerUser, uniquePhone } from "./helpers.js";
import { nameKey } from "../../app/lib/businessName.js";

describe("salon and artist names are one per account", () => {
  it("treats spacing, emoji, case and Arabic letter forms as the same name", () => {
    expect(nameKey("Frfro 🍁")).toBe(nameKey("frfro"));
    expect(nameKey("FRFRO🍁")).toBe(nameKey("Frfro"));
    expect(nameKey("آرایشگاه  ياس")).toBe(nameKey("ارایشگاه یاس"));
    expect(nameKey("سالن ۱۲")).toBe(nameKey("سالن 12"));
    expect(nameKey("سالن یاس")).not.toBe(nameKey("سالن رز"));
  });

  it("blocks a second salon or artist from taking a salon's name", async () => {
    const name = `نام‌یکتا ${uniquePhone().slice(-6)}`;
    await registerUser(createClient(), { type: "salon", name: `${name} 🍁` });

    for (const type of ["salon", "artist"]) {
      const res = await createClient().post("/api/auth/register", { phone: uniquePhone(), password: "testpass123", type, name });
      expect(res.status).toBe(409);
      expect(res.payload.code).toBe("name_taken");
    }
  });

  it("lets clients share a name with each other and with a salon", async () => {
    const name = `مشترک ${uniquePhone().slice(-6)}`;
    await registerUser(createClient(), { type: "salon", name });
    for (let i = 0; i < 2; i += 1) {
      const res = await createClient().post("/api/auth/register", { phone: uniquePhone(), password: "testpass123", type: "client", name });
      expect(res.ok).toBe(true);
    }
  });

  it("stops a rename onto another's name but always saves an unchanged one", async () => {
    const taken = `گرفته ${uniquePhone().slice(-6)}`;
    await registerUser(createClient(), { type: "artist", name: taken });
    const client = createClient();
    const { user } = await registerUser(client, { type: "salon", name: `آزاد ${uniquePhone().slice(-6)}` });

    const rename = await client.post("/api/profile", { data: { name: taken.toUpperCase() } });
    expect(rename.status).toBe(409);
    expect(rename.payload.code).toBe("name_taken");

    const same = await client.post("/api/profile", { data: { name: user.name, area: "تهران" } });
    expect(same.ok).toBe(true);
  });

  it("reports a taken name before the sign-up SMS is sent", async () => {
    const name = `پیش‌پیامک ${uniquePhone().slice(-6)}`;
    await registerUser(createClient(), { type: "salon", name });
    const res = await createClient().post("/api/auth/otp/send", { phone: uniquePhone(), purpose: "register", type: "artist", name });
    expect(res.status).toBe(409);
    expect(res.payload.code).toBe("name_taken");
  });
});
