import { describe, it, expect } from "vitest";
import { joinPathFrom } from "../../app/features/artist/PasteJoinLink.jsx";

// «لینک دعوت سالن رو اینجا بذار» (owner's decision 2026-11-02): only a salon's join link opens the join page.
describe("pasted join link", () => {
  it("opens the salon's join page from its invite link, inside a message too", () => {
    expect(joinPathFrom("https://frfro.ir/join-salon/12?k=abc123")).toBe("/join-salon/12?k=abc123");
    expect(joinPathFrom("بیا تیم ما: https://frfro.ir/join-salon/7?k=x%2By")).toBe("/join-salon/7?k=x%2By");
  });

  it("says no to anything else", () => {
    expect(joinPathFrom("https://frfro.ir/salons/12")).toBe("");
    expect(joinPathFrom("https://frfro.ir/join-salon/12")).toBe("");
    expect(joinPathFrom("https://frfro.ir/artists/3?k=abc")).toBe("");
    expect(joinPathFrom("")).toBe("");
  });
});
