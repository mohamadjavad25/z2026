// The import graph of the repo's own code, for tidying work (no dependencies, reads files only).
//
//   node scripts/tidy/graph.mjs cycles [app/lib]   import loops (files that load each other)
//   node scripts/tidy/graph.mjs names              a named import that its target does not export
//   node scripts/tidy/graph.mjs orphans            files under app/ that no page, route or layout reaches
//   node scripts/tidy/graph.mjs unused             exports no other file imports by name
//   node scripts/tidy/graph.mjs fanin              the most imported files
//   node scripts/tidy/graph.mjs importers <file>   who imports a file, and which names
//
// Run `names` and `cycles` after every move of code between files: plain `node` cannot load these modules (some
// imports have no extension), so this is the check that every import still finds its export.
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const exts = [".js", ".jsx", ".mjs"];
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".") || e.name === "graphify-out" || e.name === "mobile" || e.name === "public") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (exts.includes(path.extname(e.name))) out.push(p);
  }
  return out;
}
const files = [...walk(path.join(root, "app")), ...walk(path.join(root, "scripts")), ...walk(path.join(root, "tests"))];
const fileSet = new Set(files);
function resolve(from, spec) {
  if (!spec.startsWith(".")) return null;
  const base = path.resolve(path.dirname(from), spec);
  for (const c of [base, ...exts.map((x) => base + x), ...exts.map((x) => path.join(base, "index" + x))]) if (fileSet.has(c)) return c;
  return null;
}
const graph = new Map(); // file -> [{to, names|'*'|'ns'}]
const exportsOf = new Map();
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const deps = [];
  const re = /(?:^|[\n;])\s*(?:import|export)\s+(?:([^;"'`]*?)\s+from\s+)?["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    const to = resolve(f, m[2]);
    if (!to) continue;
    const clause = (m[1] || "").trim();
    let names = [];
    if (/^\*\s+as\s+/.test(clause) || clause === "*" ) names = ["*"];
    else {
      const braces = clause.match(/\{([\s\S]*)\}/);
      if (braces) names = braces[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
      const def = clause.replace(/\{[\s\S]*\}/, "").replace(/,/g, "").trim();
      if (def && !def.startsWith("*")) names.push("default");
      if (/\*\s+as/.test(clause)) names.push("*");
    }
    deps.push({ to, names });
  }
  const dyn = /import\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = dyn.exec(src))) { const to = resolve(f, m[1]); if (to) deps.push({ to, names: ["*"] }); }
  graph.set(f, deps);
  const ex = new Set();
  const er = /^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z0-9_$]+)/gm;
  while ((m = er.exec(src))) ex.add(m[1]);
  const er2 = /^export\s*\{([^}]*)\}\s*(?!from)/gm;
  while ((m = er2.exec(src))) m[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop().trim()).filter(Boolean).forEach((n) => ex.add(n));
  exportsOf.set(f, ex);
}
const rel = (f) => path.relative(root, f);
const mode = process.argv[2];
if (mode === "cycles") {
  // Tarjan SCC
  let idx = 0; const stack = []; const on = new Set(); const index = new Map(); const low = new Map(); const sccs = [];
  const scope = process.argv[3] || "app";
  function strong(v) {
    index.set(v, idx); low.set(v, idx); idx++; stack.push(v); on.add(v);
    for (const { to } of graph.get(v) || []) {
      if (!rel(to).startsWith(scope)) continue;
      if (!index.has(to)) { strong(to); low.set(v, Math.min(low.get(v), low.get(to))); }
      else if (on.has(to)) low.set(v, Math.min(low.get(v), index.get(to)));
    }
    if (low.get(v) === index.get(v)) { const c = []; let w; do { w = stack.pop(); on.delete(w); c.push(w); } while (w !== v); if (c.length > 1) sccs.push(c); }
  }
  for (const f of files) if (rel(f).startsWith(scope) && !index.has(f)) strong(f);
  for (const c of sccs) { console.log(`\nCYCLE GROUP (${c.length} files):`); c.map(rel).sort().forEach((x) => console.log("  " + x)); }
  console.log(`\n${sccs.length} cycle group(s)`);
}
if (mode === "unused") {
  const used = new Map(); // file -> Set(names) ; '*' means all
  for (const deps of graph.values()) for (const { to, names } of deps) {
    if (!used.has(to)) used.set(to, new Set());
    names.forEach((n) => used.get(to).add(n));
  }
  // re-exports: `export { a } from` counted as use above. `export * from` -> '*'
  for (const f of files) {
    if (!rel(f).startsWith("app/")) continue;
    if (/\/(page|layout|route|loading|error|not-found|sitemap|robots|manifest|global-error|opengraph-image|icon|apple-icon|proxy|middleware|instrumentation)\.(js|jsx)$/.test(f)) continue;
    const u = used.get(f) || new Set();
    if (u.has("*")) continue;
    const dead = [...exportsOf.get(f)].filter((n) => !u.has(n));
    if (dead.length) console.log(`${rel(f)}: ${dead.join(", ")}`);
  }
}
if (mode === "fanin") {
  const count = new Map();
  for (const deps of graph.values()) for (const { to } of deps) count.set(to, (count.get(to) || 0) + 1);
  [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).forEach(([f, n]) => console.log(n, rel(f)));
}
if (mode === "importers") {
  const target = path.resolve(root, process.argv[3]);
  for (const [f, deps] of graph) for (const { to, names } of deps) if (to === target) console.log(rel(f), "->", names.join(","));
}
if (mode === "orphans") {
  const entry = files.filter((f) => rel(f).startsWith("app/") && /\/(page|layout|route|loading|error|not-found|sitemap|robots|manifest|global-error|opengraph-image|icon|apple-icon|proxy|middleware|instrumentation|template|default)\.(js|jsx)$/.test(f));
  const extra = files.filter((f) => /^(scripts|tests)\//.test(rel(f)));
  const seen = new Set();
  const visit = (f) => { if (seen.has(f)) return; seen.add(f); for (const { to } of graph.get(f) || []) visit(to); };
  entry.forEach(visit);
  const seenWithTests = new Set(seen);
  const visit2 = (f) => { if (seenWithTests.has(f)) return; seenWithTests.add(f); for (const { to } of graph.get(f) || []) visit2(to); };
  extra.forEach(visit2);
  for (const f of files) if (rel(f).startsWith("app/") && !seen.has(f)) console.log(seenWithTests.has(f) ? "TEST/SCRIPT-ONLY" : "ORPHAN", rel(f), fs.readFileSync(f, "utf8").split("\n").length);
}
if (mode === "names") {
  // every named import must exist in its target (direct exports, `export { a as b } from`, `export * from`)
  const full = new Map();
  function exportsFull(f, trail = new Set()) {
    if (full.has(f)) return full.get(f);
    if (trail.has(f)) return new Set();
    trail.add(f);
    const src = fs.readFileSync(f, "utf8");
    const ex = new Set(exportsOf.get(f));
    let m;
    const re1 = /export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
    while ((m = re1.exec(src))) m[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop().trim()).filter(Boolean).forEach((n) => ex.add(n));
    const re2 = /export\s*\*\s*from\s*["']([^"']+)["']/g;
    while ((m = re2.exec(src))) { const to = resolve(f, m[1]); if (to) exportsFull(to, trail).forEach((n) => ex.add(n)); }
    const re3 = /export\s*\*\s*as\s+([A-Za-z0-9_$]+)\s*from/g;
    while ((m = re3.exec(src))) ex.add(m[1]);
    if (/^export\s+default\b/m.test(src)) ex.add("default");
    full.set(f, ex);
    return ex;
  }
  let bad = 0;
  for (const [f, deps] of graph) for (const { to, names } of deps) {
    const ex = exportsFull(to);
    for (const n of names) if (n !== "*" && !ex.has(n)) { bad += 1; console.log(`${rel(f)} imports missing "${n}" from ${rel(to)}`); }
  }
  console.log(`${bad} missing name(s)`);
}
