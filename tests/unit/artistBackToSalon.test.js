import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A salon owner (or client) opens a team artist from the salon page; «back» from the artist must land on the salon
// page again, not on an empty tab. There is no React test harness here, so this pins the wiring in the source.
const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");

describe("back from an artist opened on a salon page", () => {
  it("the salon page hands itself over when it opens the artist", () => {
    expect(read("app/features/shell/home/ContentPages.jsx")).toMatch(/openPublicArtistProfile\([^)]*\{ fromSalon: selectedSalon \}\)/);
  });

  it("the artist page's close and the phone's back button both ask to restore the salon", () => {
    expect(read("app/features/shell/home/PublicArtistHost.jsx")).toContain("closePublicArtistProfile({ restoreSalon: true })");
    expect(read("app/features/shell/useHomeChrome.jsx")).toContain("closePublicArtistProfile({ restoreSalon: true })");
  });

  it("only that explicit close brings the salon back; other closes forget it", () => {
    const hook = read("app/features/artist/usePublicArtistProfile.js");
    expect(hook).toContain("options?.restoreSalon === true");
    expect(hook).toContain("fromSalonRef.current = null");
  });
});
