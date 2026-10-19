import { afterEach, describe, expect, it, vi } from "vitest";

const sent = [];
const pushed = [];
let reachedPhones = [];

vi.mock("../../app/lib/admin.js", () => ({ adminPhoneList: () => ["09120000001", "09120000002"] }));
vi.mock("../../app/lib/rateLimit.js", () => ({ checkRateLimit: async () => ({ ok: true }) }));
vi.mock("../../app/lib/sms.js", () => ({ sendTemplateSms: async (phone, name) => { sent.push([phone, name]); } }));
vi.mock("../../app/lib/adminPush.js", () => ({
  pushAdmins: async (message) => { pushed.push(message); return new Set(reachedPhones); }
}));

const { smsAdminsSupport } = await import("../../app/lib/adminSms.js");
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

afterEach(() => { sent.length = 0; pushed.length = 0; reachedPhones = []; });

describe("admin news", () => {
  it("goes as a push to the admin app and an SMS only to admins without it", async () => {
    reachedPhones = ["09120000001"];
    smsAdminsSupport("support", { topic: "سؤال", who: "سارا" });
    await settle();
    expect(pushed).toEqual([{ title: "سؤال", body: "از سارا", url: "/admin?p=support" }]);
    expect(sent).toEqual([["09120000002", "admin_support"]]);
  });

  it("sends no SMS when every admin has the app, and opens the right page", async () => {
    reachedPhones = ["09120000001", "09120000002"];
    smsAdminsSupport("password-reset", { topic: "بازیابی رمز", who: "0912" });
    await settle();
    expect(pushed[0].url).toBe("/admin?p=resets");
    expect(sent).toEqual([]);
  });
});
