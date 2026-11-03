import { describe, it, expect } from "vitest";
import { checkAddedLines, checkTree, parseAddedLines } from "../../scripts/guard/rules.mjs";

/** The commit and CI guard for CLAUDE.md's hard rules (scripts/guard/). Each case is a mistake it must stop. */
const blocks = (added) => checkAddedLines(added).filter((f) => f.level === "block");

describe("guard: added lines", () => {
  it("stops a wrong product name in code, not in docs that quote the rule", () => {
    expect(blocks([{ file: "app/features/landing/Hero.jsx", line: 3, text: "<h1>Farfaroo</h1>" }])).toHaveLength(1);
    expect(blocks([{ file: "app/x.js", line: 1, text: "const t = 'زیبابان';" }])).toHaveLength(1);
    expect(blocks([{ file: "CLAUDE.md", line: 1, text: 'Never "Farfaroo"' }])).toHaveLength(0);
    expect(blocks([{ file: "docs/PROJECT_NOTES.md", line: 1, text: "ZIBABAN_* renamed" }])).toHaveLength(0);
  });

  it("stops «دنبال کردن» in the app", () => {
    expect(blocks([{ file: "app/features/x/Button.jsx", line: 1, text: "<b>دنبال کردن</b>" }])).toHaveLength(1);
  });

  it("stops a hand-written colour in app CSS but lets tokens, masks and the admin panel through", () => {
    expect(blocks([{ file: "app/styles/features/x.css", line: 1, text: "  color: #14161d;" }])).toHaveLength(1);
    expect(blocks([{ file: "app/styles/features/x.css", line: 1, text: "  background: rgba(0,0,0,.4);" }])).toHaveLength(1);
    expect(blocks([{ file: "app/styles/features/x.css", line: 1, text: "  color: var(--ink);" }])).toHaveLength(0);
    expect(blocks([{ file: "app/styles/features/x.css", line: 1, text: "  mask: radial-gradient(#000 10px, transparent);" }])).toHaveLength(0);
    expect(blocks([{ file: "app/styles/tokens.css", line: 1, text: "  --pink: #ff86b8;" }])).toHaveLength(0);
    expect(blocks([{ file: "app/admin/admin.css", line: 1, text: "  color: #333;" }])).toHaveLength(0);
    expect(blocks([{ file: "app/styles/features/x.css", line: 1, text: "  color: var(--ink); /* was #333 */" }])).toHaveLength(0);
  });

  it("only reminds about a colour in JS (canvas and illustrations need them)", () => {
    const found = checkAddedLines([{ file: "app/features/x/Story.jsx", line: 1, text: 'ctx.fillStyle = "#ffffff";' }]);
    expect(found.map((f) => f.level)).toEqual(["warn"]);
  });

  it("stops downloads being switched and the app version being raised", () => {
    expect(blocks([{ file: "app/features/landing/constants.js", line: 7, text: "export const APP_DOWNLOADS_OPEN = false;" }])).toHaveLength(1);
    expect(blocks([{ file: "mobile/android/app/build.gradle", line: 13, text: '        versionName "1.0.1"' }])).toHaveLength(1);
    expect(blocks([{ file: "mobile/android/app/build.gradle", line: 13, text: '        versionName "1.0.0"' }])).toHaveLength(0);
  });
});

describe("guard: the tree", () => {
  it("stops a signing key from being committed", () => {
    expect(checkTree({ trackedFiles: ["mobile/android/frfro-release.keystore"] })).toHaveLength(1);
  });

  it("stops a new migration that reuses a number or is not above main", () => {
    const main = ["migrations/065_a.sql", "migrations/066_b.sql"];
    expect(checkTree({ trackedFiles: [...main, "migrations/066_c.sql"], baseMigrations: main, newMigrations: ["migrations/066_c.sql"] }).length).toBeGreaterThan(0);
    expect(checkTree({ trackedFiles: [...main, "migrations/064_c.sql"], baseMigrations: main, newMigrations: ["migrations/064_c.sql"] }).length).toBeGreaterThan(0);
    expect(checkTree({ trackedFiles: [...main, "migrations/067_c.sql"], baseMigrations: main, newMigrations: ["migrations/067_c.sql"] })).toHaveLength(0);
  });

  it("lets the old duplicate 038 on main be", () => {
    expect(checkTree({ trackedFiles: ["migrations/038_a.sql", "migrations/038_b.sql"] })).toHaveLength(0);
  });
});

describe("guard: reading a diff", () => {
  it("finds added lines with their numbers", () => {
    const diff = ["diff --git a/x.css b/x.css", "--- a/x.css", "+++ b/x.css", "@@ -4,0 +5,2 @@", "+a", "+b", "@@ -9 +11 @@", "-old", "+c"].join("\n");
    expect(parseAddedLines(diff)).toEqual([
      { file: "x.css", line: 5, text: "a" },
      { file: "x.css", line: 6, text: "b" },
      { file: "x.css", line: 11, text: "c" },
    ]);
  });
});
