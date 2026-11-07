import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// An artist's public page lost the name: it rises into the cover, and the cover drew over it. Every artist page, live.
describe("the artist's name on the public page", () => {
  const css = readFileSync(new URL("../../app/styles/features/publicProfile.css", import.meta.url), "utf8");

  it("sits above the cover it rises into", () => {
    expect(css).toMatch(/\.pphHero\.is-artist \.pphMeta h2 \{ margin-top: -/);
    expect(css).toMatch(/\.pphHero\.is-artist \.pphMeta \{ position: relative; z-index: 3; \}/);
  });
});
