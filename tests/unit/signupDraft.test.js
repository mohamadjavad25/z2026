import { describe, it, expect, beforeEach, vi } from "vitest";
import { SIGNUP_DRAFT_TTL_MS, clearSignupDraft, readSignupDraft, saveSignupDraft } from "../../app/features/auth/signupDraft.js";

function fakeStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}

describe("signup draft (kept 10 minutes in the tab)", () => {
  beforeEach(() => { vi.stubGlobal("window", { sessionStorage: fakeStorage() }); });

  it("remembers phone and name, and never a password", () => {
    saveSignupDraft({ phone: "09123456789", name: "سارا" }, 1000);
    expect(readSignupDraft(1000 + 5 * 60 * 1000)).toEqual({ phone: "09123456789", name: "سارا" });
    expect(JSON.stringify(window.sessionStorage.getItem("frfro_signup_draft"))).not.toMatch(/password/);
  });

  it("forgets after 10 minutes and when cleared", () => {
    saveSignupDraft({ phone: "09123456789", name: "" }, 1000);
    expect(readSignupDraft(1000 + SIGNUP_DRAFT_TTL_MS + 1)).toEqual({ phone: "", name: "" });
    saveSignupDraft({ phone: "09123456789", name: "" }, Date.now());
    clearSignupDraft();
    expect(readSignupDraft()).toEqual({ phone: "", name: "" });
  });

  it("does not throw when storage is blocked", () => {
    vi.stubGlobal("window", { get sessionStorage() { throw new Error("blocked"); } });
    expect(() => saveSignupDraft({ phone: "1", name: "" })).not.toThrow();
    expect(readSignupDraft()).toEqual({ phone: "", name: "" });
  });
});
