import { afterEach, describe, expect, it, vi } from "vitest";

const pushed = [];
let allowed = true;

vi.mock("../../app/lib/rateLimit.js", () => ({ checkRateLimit: async () => ({ ok: allowed }) }));
vi.mock("../../app/lib/adminPush.js", () => ({
  pushAdmins: async (message) => { pushed.push(message); return new Set(); }
}));

const { alertAdminsServerError } = await import("../../app/lib/serverErrorAlert.js");
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

afterEach(() => { pushed.length = 0; allowed = true; });

describe("server error alert", () => {
  it("pushes the operator's app once when a route crashes", async () => {
    alertAdminsServerError();
    await settle();
    expect(pushed).toHaveLength(1);
    expect(pushed[0].title).toBe("خطای سرور فرفرو");
  });

  it("sends nothing inside the quiet window", async () => {
    allowed = false;
    alertAdminsServerError();
    await settle();
    expect(pushed).toEqual([]);
  });
});
