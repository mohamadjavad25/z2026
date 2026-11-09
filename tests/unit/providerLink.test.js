import { describe, it, expect } from "vitest";
import { providerLinkCode, providerLinkPath } from "../../app/shared/lib/providerLink.js";

describe("the short link in the SMS", () => {
  it("goes round trip for artists and salons", () => {
    expect(providerLinkPath(providerLinkCode("artist", 4447))).toBe("/artists/4447");
    expect(providerLinkPath(providerLinkCode("salon", 12))).toBe("/salons/12");
  });

  it("refuses anything else", () => {
    for (const bad of ["", "x12", "a", "a0", "a-1", "../a1", "a123456789", null]) expect(providerLinkPath(bad)).toBe(null);
  });
});
