// Moves code between files by exact line ranges, so a split never retypes a line.
//
//   import { build, checkCoverage } from "./slice.mjs";
//   build({ orig, out, header, ranges: [[from, to], ...], exportNames: ["nowShared"], edits: [[old, new]] });
//   checkCoverage(orig, firstLine, lastLine, allRangesUsed, skippedRanges)  ->  [] when every line landed exactly once
//
// Work from a copy of the original file (the split overwrites the original with its door), write each new file's
// imports as `header`, then let `npm run lint` name what is missing or unused and `graph.mjs names` check the rest.
import fs from "node:fs";
export function build({ orig, out, header, ranges, exportNames = [], edits = [] }) {
  const lines = fs.readFileSync(orig, "utf8").split("\n");
  const chunks = ranges.map(([from, to]) => lines.slice(from - 1, to).join("\n"));
  let body = chunks.join("\n\n");
  for (const name of exportNames) {
    const re = new RegExp(`^(async function ${name}\\b|function ${name}\\b|const ${name}\\b|class ${name}\\b)`, "m");
    if (!re.test(body)) throw new Error(`${out}: cannot export ${name}`);
    body = body.replace(re, "export $1");
  }
  for (const [from, to, every] of edits) {
    if (every) { if (!body.includes(from)) throw new Error(`${out}: edit target not found: ${from}`); body = body.split(from).join(to); continue; }
    if (!body.includes(from)) throw new Error(`${out}: edit target not found: ${from.slice(0, 60)}`);
    if (body.split(from).length !== 2) throw new Error(`${out}: edit target not unique: ${from.slice(0, 60)}`);
    body = body.replace(from, () => to);
  }
  fs.mkdirSync(out.replace(/\/[^/]+$/, ""), { recursive: true });
  fs.writeFileSync(out, `${header.trim()}\n\n${body.trim()}\n`);
  return ranges;
}
/** Every line of [first,last] must be covered exactly once by the given range lists (blank lines between may be left out). */
export function checkCoverage(orig, first, last, allRanges, skip = []) {
  const lines = fs.readFileSync(orig, "utf8").split("\n");
  const seen = new Array(lines.length + 2).fill(0);
  for (const [a, b] of [...allRanges, ...skip]) for (let i = a; i <= b; i += 1) seen[i] += 1;
  const problems = [];
  for (let i = first; i <= last; i += 1) {
    if (seen[i] > 1) problems.push(`line ${i} taken ${seen[i]} times`);
    if (seen[i] === 0 && lines[i - 1].trim() !== "") problems.push(`line ${i} lost: ${lines[i - 1].slice(0, 70)}`);
  }
  return problems;
}
