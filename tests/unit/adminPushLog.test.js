import { afterEach, describe, expect, it, vi } from "vitest";

// 2026-11-08: a sign-up notice did not show on the owner's phone and the server could not say whether Google took it.
// Every admin push now leaves one «push.admin» log line with how many apps Google accepted and why the rest failed.
const send = vi.fn();
vi.mock("../../app/lib/fcm.js", () => ({
  fcmConfigured: () => true,
  sendFcm: (...args) => send(...args),
  fcmThrowReason: (error) => String(error?.cause?.code || error?.name || "error")
}));
vi.mock("../../app/lib/admin.js", () => ({ adminPhoneList: () => ["09120000001", "09120000002"] }));
vi.mock("../../app/lib/db/repos/adminPush.js", () => ({
  listFreshTokensForPhones: async () => [{ id: 1, token: "a", phone: "09120000001" }, { id: 2, token: "b", phone: "09120000002" }],
  removeTokenById: vi.fn(async () => {})
}));

const { pushAdmins } = await import("../../app/lib/adminPush.js");

const logged = (spy) => spy.mock.calls.map(([line]) => JSON.parse(line)).filter((entry) => entry.message === "push.admin");

afterEach(() => { send.mockReset(); vi.restoreAllMocks(); });

describe("pushAdmins log line", () => {
  it("records how many admin apps Google took", async () => {
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    send.mockResolvedValue({ ok: true });
    const reached = await pushAdmins({ title: "ثبت‌نام امروز", tag: "signups" });
    expect(reached.size).toBe(2);
    expect(logged(out)).toEqual([expect.objectContaining({ tag: "signups", apps: 2, accepted: 2 })]);
  });

  it("records the reason when Google refused or could not be reached", async () => {
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    send.mockResolvedValueOnce({ ok: false, gone: true, reason: "404 NOT_FOUND" })
      .mockRejectedValueOnce(Object.assign(new Error("fetch failed"), { cause: { code: "ETIMEDOUT" } }));
    const reached = await pushAdmins({ title: "x", tag: "signups" });
    expect(reached.size).toBe(0);
    expect(out).not.toHaveBeenCalled();
    expect(logged(warn)[0]).toMatchObject({ level: "warn", apps: 2, accepted: 0 });
    expect(logged(warn)[0].failures.sort()).toEqual(["404 NOT_FOUND", "ETIMEDOUT"]);
  });
});
