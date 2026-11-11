// Exports whose name appears in no other file of the repo (app, scripts, tests, mobile): candidates to delete.
//
//   node scripts/tidy/dead-exports.mjs [app/lib]        names used nowhere at all
//   node scripts/tidy/dead-exports.mjs app/lib all      also names used only inside their own file (exported for nothing)
//
// A word match, so it never calls something dead that is used through a namespace (`artists.foo`). Read each hit
// before deleting: a function may be the reader that a screen not built yet is waiting for.
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "graphify-out", "public", ".next", ".git"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|jsx|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}
const all = [...walk(root + "/app"), ...walk(root + "/scripts").filter((f) => !f.includes("/scripts/tidy/")), ...walk(root + "/tests"), ...walk(root + "/mobile").filter((f) => !f.includes("/android/") && !f.includes("/ios/"))];
const text = new Map(all.map((f) => [f, fs.readFileSync(f, "utf8")]));
const words = new Map(); // word -> Set(files)
for (const [f, src] of text) for (const w of new Set(src.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || [])) { if (!words.has(w)) words.set(w, new Set()); words.get(w).add(f); }
const scope = process.argv[2] || "app/lib";
for (const f of all) {
  const r = path.relative(root, f);
  if (!r.startsWith(scope)) continue;
  if (/\/(page|layout|route|loading|error|not-found|sitemap|robots|manifest|global-error|proxy|middleware|instrumentation)\.(js|jsx)$/.test(f)) continue;
  const src = text.get(f);
  const names = new Set();
  let m; const er = /^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z0-9_$]+)/gm;
  while ((m = er.exec(src))) names.add(m[1]);
  const dead = [], local = [];
  for (const n of names) {
    const others = [...(words.get(n) || [])].filter((x) => x !== f);
    if (others.length) continue;
    const count = (src.match(new RegExp(`\\b${n.replace(/\$/g, "\\$")}\\b`, "g")) || []).length;
    (count > 1 ? local : dead).push(n);
  }
  if (dead.length) console.log(`DEAD   ${r}: ${dead.join(", ")}`);
  if (local.length && process.argv[3] === "all") console.log(`LOCAL  ${r}: ${local.join(", ")}`);
}
