
import { readFileSync, writeFileSync } from "node:fs";
const file = "app/styles/features/shops.css";
const lines = readFileSync(file, "utf8").split("\n");

const DEAD = new Set([
  "shopStoreSpotlight", "shopStoreSpotlightHead", "shopStoreSpotlightRail",
  "shopStoreBack", "shopStoreHeroBody", "shopStoreBrand", "shopStoreStat",
  "shopStoreStatIcon", "shopStorePromise", "shopStorePromiseItem",
  "shopStorePromiseIcon", "shopStoreSection", "shopStoreReviewsSection",
  "shopStoreCta", "shopStoreTopBrand", "shopStoreSearch", "shopStoreTopActions"
]);
const STRUCTURAL = new Set(["appShell", "is-shop-store"]);
const clsRe = /\.([A-Za-z][A-Za-z0-9_-]*)/g;
const classesOf = (line) => [...line.matchAll(clsRe)].map((m) => m[1]);

const toDelete = [];
for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  if (!t || t.startsWith("@media") || t.startsWith("}") || t.startsWith("/*")) continue;
  let sel = lines[i];
  let j = i;
  while (j + 1 < lines.length && !sel.includes("{")) {
    j++;
    sel += " " + lines[j];
  }
  const tokens = classesOf(sel);
  const nonStructural = tokens.filter((c) => !STRUCTURAL.has(c));
  const allDead = nonStructural.length > 0 && nonStructural.every((c) => DEAD.has(c));
  if (allDead) {
    let depth = 0;
    let found = -1;
    for (let k = j; k < lines.length; k++) {
      const s = lines[k];
      depth += (s.match(/{/g) || []).length;
      depth -= (s.match(/}/g) || []).length;
      if (depth <= 0 && s.trim().startsWith("}")) { found = k; break; }
    }
    if (found === -1) { console.error("no close at", i + 1); process.exit(1); }
    toDelete.push([i, found]);
    i = found;
  }
}

toDelete.sort((a, b) => a[0] - b[0]);
const merged = [];
for (const [s, e] of toDelete) {
  const last = merged[merged.length - 1];
  if (last && s <= last[1] + 1) last[1] = Math.max(last[1], e);
  else merged.push([s, e]);
}
const deleted = new Set();
for (const [s, e] of merged) for (let k = s; k <= e; k++) deleted.add(k);
const out = lines.filter((_, idx) => !deleted.has(idx));
const cleaned = [];
let blankRun = 0;
for (const l of out) {
  if (l.trim() === "") { blankRun++; if (blankRun <= 2) cleaned.push(l); }
  else { blankRun = 0; cleaned.push(l); }
}
writeFileSync(file, cleaned.join("\n"), "utf8");
console.log("removed:", merged.length, "rules | lines:", lines.length, "->", cleaned.length);
