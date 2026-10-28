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

  it("takes the page from a story link and refuses post, reel and other non-page links", () => {
    expect(normalizeInstagram("https://instagram.com/stories/salon.roz/3312?igsh=x")).toBe("salon.roz");
    expect(normalizeInstagram("http://m.instagram.com/salon.roz")).toBe("salon.roz");
    expect(normalizeInstagram("instagr.am/Salon.Roz/")).toBe("salon.roz");
    for (const bad of ["https://www.instagram.com/p/C9xYz12/", "instagram.com/reel/abc", "instagram.com/reels/abc", "instagram.com/explore/tags/nail", "instagram.com/accounts/login"]) {
      expect(normalizeInstagram(bad)).toBeNull();
    }
  });

  it("reads Persian and Arabic digits as digits", () => {
    expect(normalizeInstagram("negar.nails۱۴۰۳")).toBe("negar.nails1403");
    expect(normalizeInstagram("salon٢")).toBe("salon2");
  });

  it("never returns anything but a clean page name, whatever is typed", () => {
    const pool = "aZ09._-@/:?#&=<>\"' %\u0000\u200f\u202eسلام۱ instagram.com/ https://";
    let seed = 7;
    const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    for (let i = 0; i < 20000; i += 1) {
      let text = "";
      const len = rand(60);
      for (let j = 0; j < len; j += 1) text += pool[rand(pool.length)];
      const out = normalizeInstagram(text);
      if (out === null || out === "") continue;
      expect(out).toMatch(/^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{1,30}$/);
    }
  });

  it("builds the page link", () => {
    expect(instagramUrl("salon.roz")).toBe("https://instagram.com/salon.roz");
    expect(instagramUrl("")).toBe("");
  });
});
