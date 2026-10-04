import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Stacking order lives in app/styles/tokens.css. Page-level layers may use
 *  small local numbers; anything >= 100 must be a named --z-* token, and every
 *  referenced token must exist. */
function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(css|jsx?)$/.test(name)) out.push(path);
  }
  return out;
}

const all = files("app");
const tokens = readFileSync("app/styles/tokens.css", "utf8");
const defined = new Set([...tokens.matchAll(/(--z-[\w-]+)\s*:/g)].map((m) => m[1]));

describe("z-index scale", () => {
  it("has no raw z-index >= 100 outside tokens.css", () => {
    const offenders = [];
    for (const file of all) {
      if (file.endsWith("tokens.css")) continue;
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/z-?[iI]ndex\s*[:=]\s*["']?(\d{3,})/g)) offenders.push(`${file}: ${m[0]}`);
    }
    expect(offenders).toEqual([]);
  });

  it("only references defined --z-* tokens", () => {
    const missing = [];
    for (const file of all) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/var\((--z-[\w-]+)\)/g)) if (!defined.has(m[1])) missing.push(`${file}: ${m[1]}`);
    }
    expect(missing).toEqual([]);
  });
});
