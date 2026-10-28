import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Guards for the colour system (docs/DESIGN_SYSTEM.md, «سیستم رنگ»).
 *  1. No color-mix() in the app: translucent colours use rgb(var(--x-rgb) / a), which works in old Android WebViews
 *     (color-mix needs Chrome 111). The admin panel predates this rule and is exempt.
 *  2. Every --*-rgb channel token that is used is defined somewhere.
 *  3. The neutral ramp exists in two spellings (hex and "R G B" channels); they must agree in day and night. */
function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(css|jsx?)$/.test(name)) out.push(path);
  }
  return out;
}

const all = files("app").map((file) => file.replaceAll("\\", "/")); // forward slashes on Windows too
const isAdmin = (file) => /(^|\/)admin/.test(file.replace(/^app\//, "")) || /\/admin[-\w]*\.css$/.test(file);
const tokens = readFileSync("app/styles/tokens.css", "utf8");

/** Text of every block that starts with the exact selector header, merged. */
function blocks(source, header) {
  let out = "";
  let at = source.indexOf(header);
  while (at !== -1) {
    const open = source.indexOf("{", at);
    let depth = 1;
    let i = open + 1;
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") depth -= 1;
      i += 1;
    }
    out += source.slice(open + 1, i - 1);
    at = source.indexOf(header, i);
  }
  return out;
}

function ramp(text) {
  const hex = {};
  const rgb = {};
  for (const m of text.matchAll(/--n-(\d+):\s*#([0-9a-f]{6});/gi)) hex[m[1]] = [0, 2, 4].map((o) => parseInt(m[2].slice(o, o + 2), 16)).join(" ");
  for (const m of text.matchAll(/--n-(\d+)-rgb:\s*(\d+ \d+ \d+);/g)) rgb[m[1]] = m[2];
  return { hex, rgb };
}

describe("colour system", () => {
  it("uses no color-mix() outside the admin panel", () => {
    const offenders = [];
    for (const file of all) {
      if (isAdmin(file) || file.endsWith("tokens.css")) continue;
      const text = readFileSync(file, "utf8");
      if (/color-mix\s*\(/.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("defines every channel token it uses", () => {
    const defined = new Set();
    for (const file of all) for (const m of readFileSync(file, "utf8").matchAll(/(--[\w-]+-rgb)\s*:/g)) defined.add(m[1]);
    const missing = [];
    for (const file of all) {
      if (isAdmin(file)) continue;
      for (const m of readFileSync(file, "utf8").matchAll(/var\((--[\w-]+-rgb)[,)]/g)) if (!defined.has(m[1])) missing.push(`${file}: ${m[1]}`);
    }
    expect(missing).toEqual([]);
  });

  it("keeps the neutral ramp's hex and channel spellings in step, day and night", () => {
    const day = ramp(blocks(tokens, ":root {"));
    const night = ramp(blocks(tokens, ':root[data-theme="dark"] {'));
    const nightAuto = ramp(blocks(tokens, ":root:not([data-theme=\"light\"]) {"));
    for (const { hex, rgb } of [day, night, nightAuto]) {
      expect(Object.keys(hex).length).toBe(14);
      expect(rgb).toEqual(hex);
    }
    expect(nightAuto.hex).toEqual(night.hex);
  });
});
