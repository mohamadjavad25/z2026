
import { readFileSync, writeFileSync } from "node:fs";
const file = "app/styles/features/shops.css";
const lines = readFileSync(file, "utf8").split("\n");
const DEAD_ANCHOR = new Set(["shopStoreSection", "shopStoreHeroBrand", "shopStoreHeroTitle", "shopStoreRatingSummary"]);
const clsRe = /\.([A-Za-z][A-Za-z0-9_-]*)/g;

const toDelete = [];
for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  if (!t || t.startsWith("@media") || t.startsWith("}") || t.startsWith("/*")) continue;
  let sel = lines[i];
  let j = i;
  while (j + 1 < lines.length && !sel.includes("{")) { j++; sel += " " + lines[j]; }
  const classes = [...sel.matchAll(clsRe)].map((m) => m[1]);
  if (classes.some((c) => DEAD_ANCHOR.has(c))) {
    let d = 0, sawOpen = false, found = -1;
    for (let k = i; k < lines.length; k++) {
      const s = lines[k];
      const o = (s.match(/{/g) || []).length;
      const c = (s.match(/}/g) || []).length;
      d += o - c;
      if (o > 0) sawOpen = true;
      if (sawOpen && d <= 0 && c > 0) { found = k; break; }
    }
    if (found === -1) { console.error("no close at", i + 1, t); process.exit(1); }
    toDelete.push([i, found]);
    i = found;
  }
}
toDelete.sort((a, b) => a[0] - b[0]);
const deleted = new Set();
for (const [s, e] of toDelete) for (let k = s; k <= e; k++) deleted.add(k);
const out = lines.filter((_, idx) => !deleted.has(idx));
const cleaned = [];
let blankRun = 0;
for (const l of out) {
  if (l.trim() === "") { blankRun++; if (blankRun <= 2) cleaned.push(l); }
  else { blankRun = 0; cleaned.push(l); }
}
writeFileSync(file, cleaned.join("\n"), "utf8");
console.log("removed:", toDelete.length, "rules | lines:", lines.length, "->", cleaned.length);
