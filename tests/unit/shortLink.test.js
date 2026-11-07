import { describe, expect, it } from "vitest";
import { GET as artistShort } from "../../app/a/[id]/route.js";
import { GET as salonShort } from "../../app/s/[id]/route.js";
import { directMessageText, publicPathFromShort, shortPublicPath } from "../../app/shared/lib/shortLink.js";

describe("short public addresses", () => {
  it("builds the short path for each kind of page", () => {
    expect(shortPublicPath("artist", 4447)).toBe("/a/4447");
    expect(shortPublicPath("salon", "12")).toBe("/s/12");
  });

  it("reads Latin and Persian digits, also when the browser encoded them", () => {
    expect(publicPathFromShort("artist", "4447")).toBe("/artists/4447");
    expect(publicPathFromShort("salon", "۴۴۴۷")).toBe("/salons/4447");
    expect(publicPathFromShort("artist", encodeURIComponent("۴۴۴۷"))).toBe("/artists/4447");
  });

  it("sends anything that is not a page number home, never to another site", () => {
    for (const bad of ["abc", "0", "-1", "12a", "", "//evil.example", "%E0%A4%A", "1".repeat(16)]) {
      expect(publicPathFromShort("artist", bad)).toBe("/");
    }
  });

  it("redirects with a relative address, so nginx's localhost never leaks", async () => {
    const artist = await artistShort(new Request("http://localhost:3000/a/4447"), { params: Promise.resolve({ id: "4447" }) });
    expect(artist.status).toBe(307);
    expect(artist.headers.get("location")).toBe("/artists/4447");
    const salon = await salonShort(new Request("http://localhost:3000/s/9"), { params: Promise.resolve({ id: "۹" }) });
    expect(salon.headers.get("location")).toBe("/salons/9");
  });

  it("puts the address in the ready message", () => {
    expect(directMessageText("frfro.ir/a/4447")).toContain("frfro.ir/a/4447");
  });
});
