import { describe, expect, it } from "vitest";
import { instagramUrl, normalizeInstagram } from "../../app/shared/lib/instagram.js";

describe("normalizeInstagram", () => {
  it("keeps the page name from every pasted shape", () => {
    expect(normalizeInstagram("@Salon.Roz")).toBe("salon.roz");
    expect(normalizeInstagram("salon_roz")).toBe("salon_roz");
    expect(normalizeInstagram("https://www.instagram.com/salon.roz/?igsh=abc")).toBe("salon.roz");
    expect(normalizeInstagram("instagram.com/salon.roz")).toBe("salon.roz");
    expect(normalizeInstagram("  @@salon.roz  ")).toBe("salon.roz");
  });

  it("empty means none", () => {
    expect(normalizeInstagram("")).toBe("");
    expect(normalizeInstagram("   ")).toBe("");
    expect(normalizeInstagram(undefined)).toBe("");
  });

  it("refuses what cannot be an Instagram name", () => {
    for (const bad of ["سالن رز", "salon roz", ".salon", "salon.", "sa..lon", "a".repeat(31), "salon!", "javascript:alert(1)"]) {
      expect(normalizeInstagram(bad)).toBeNull();
    }
  });

  it("builds the page link", () => {
    expect(instagramUrl("salon.roz")).toBe("https://instagram.com/salon.roz");
    expect(instagramUrl("")).toBe("");
  });
});
