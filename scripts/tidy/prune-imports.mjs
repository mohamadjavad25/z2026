// Removes the imported names a file does not use, after a split that started each new file with every import of the
// original (see slice.mjs). It only touches `import { a, b } from "x"` lists and whole unused default imports.
//
//   node scripts/tidy/prune-imports.mjs app/features/schedule/MoveTimeList.jsx [more files]
//
// It asks ESLint which names are unused, so it never guesses. Run `npm run check` afterwards.
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const files = process.argv.slice(2);
if (!files.length) { console.error("usage: prune-imports.mjs <file> [file...]"); process.exit(1); }
let json;
try {
  json = execFileSync("npx", ["eslint", "--format", "json", "--rule", '{"no-unused-vars":"warn"}', ...files], { encoding: "utf8", maxBuffer: 1 << 26 });
} catch (error) {
  json = error.stdout; // eslint exits 1 when it has errors; the report is still on stdout
}
for (const report of JSON.parse(json)) {
  const unused = new Set(report.messages.filter((m) => m.ruleId === "no-unused-vars").map((m) => (m.message.match(/^'([^']+)'/) || [])[1]).filter(Boolean));
  if (!unused.size) continue;
  const source = fs.readFileSync(report.filePath, "utf8");
  let removed = 0;
  const next = source.replace(/^import\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*("[^"]+"|'[^']+');?[ \t]*\n/gm, (whole, def, list, from) => {
    const names = list == null ? null : list.split(",").map((s) => s.trim()).filter(Boolean);
    const keptNames = names ? names.filter((spec) => !unused.has(spec.split(/\s+as\s+/).pop())) : null;
    const keepDef = def && !unused.has(def);
    removed += (names ? names.length - keptNames.length : 0) + (def && !keepDef ? 1 : 0);
    if (!keepDef && (!keptNames || !keptNames.length)) return def || names ? "" : whole;
    if (keptNames && names && keptNames.length === names.length && (keepDef || !def)) return whole;
    const multi = list && list.includes("\n");
    const braces = keptNames && keptNames.length ? (multi ? `{\n  ${keptNames.join(",\n  ")}\n}` : `{ ${keptNames.join(", ")} }`) : "";
    return `import ${[keepDef ? def : "", braces].filter(Boolean).join(", ")} from ${from};\n`;
  });
  fs.writeFileSync(report.filePath, next);
  console.log(`${report.filePath.replace(process.cwd() + "/", "")}: ${removed} unused import name(s) removed`);
}
