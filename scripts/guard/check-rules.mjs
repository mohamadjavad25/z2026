#!/usr/bin/env node
// Checks a change against the machine-checkable hard rules of CLAUDE.md (scripts/guard/rules.mjs).
//
//   node scripts/guard/check-rules.mjs                 what the next commit would carry: tracked changes + new files
//   node scripts/guard/check-rules.mjs --base <ref>    everything since <ref> (CI: the pull request's base)
//   node scripts/guard/check-rules.mjs --hook          PreToolUse hook: reads the tool call on stdin and runs only
//                                                      for a `git commit`; exit 2 sends the reason back to Claude
//
// A block can be let through only when the owner said so in this conversation: put [owner-ok] in the commit
// message (CI looks for it in the commits of the range). Exit 0 = fine, 1 = blocked (2 in hook mode).
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { checkAddedLines, checkTree, parseAddedLines } from "./rules.mjs";

const args = process.argv.slice(2);
const hook = args.includes("--hook");
const baseAt = args.indexOf("--base");
let base = baseAt !== -1 ? args[baseAt + 1] : null;

const git = (...a) => {
  try { return execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; }
};

let ownerOk = false;
if (hook) {
  let input = {};
  try { input = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch { /* no input: nothing to check */ }
  const command = String(input?.tool_input?.command || "");
  if (!/\bgit\b[^|;&]*\bcommit\b/.test(command)) process.exit(0);
  ownerOk = command.includes("[owner-ok]");
}

if (base && git("rev-parse", "--verify", "--quiet", `${base}^{commit}`) === null) base = null; // new branch / shallow clone

let added;
let newFiles;
if (base) {
  added = parseAddedLines(git("diff", "-U0", "--no-color", "--no-ext-diff", `${base}...HEAD`) || "");
  newFiles = (git("diff", "--name-only", "--diff-filter=A", `${base}...HEAD`) || "").split("\n").filter(Boolean);
  ownerOk = ownerOk || /\[owner-ok\]/.test(git("log", "--format=%B", `${base}..HEAD`) || "");
} else {
  added = parseAddedLines(git("diff", "-U0", "--no-color", "--no-ext-diff", "HEAD") || "");
  newFiles = (git("diff", "--name-only", "--diff-filter=A", "HEAD") || "").split("\n").filter(Boolean);
  // Files not yet added count as fully new: `git add -A && git commit` adds them in the same command.
  for (const file of (git("ls-files", "--others", "--exclude-standard") || "").split("\n").filter(Boolean)) {
    newFiles.push(file);
    if (!existsSync(file)) continue;
    let text;
    try { text = readFileSync(file, "utf8"); } catch { continue; }
    if (text.includes("\u0000")) continue; // binary
    text.split("\n").forEach((t, i) => added.push({ file, line: i + 1, text: t }));
  }
}

const trackedFiles = [
  ...(git("ls-files") || "").split("\n").filter(Boolean),
  ...newFiles,
];
const mainRef = git("rev-parse", "--verify", "--quiet", "origin/main") ? "origin/main" : null;
const baseMigrations = mainRef ? (git("ls-tree", "--name-only", `${mainRef}:migrations`) || "").split("\n").filter(Boolean).map((f) => `migrations/${f}`) : [];
const newMigrations = newFiles.filter((f) => /^migrations\/\d+_/.test(f) && !baseMigrations.includes(f));

const findings = [...checkAddedLines(added), ...checkTree({ trackedFiles: [...new Set(trackedFiles)], baseMigrations, newMigrations })];
const blocks = findings.filter((f) => f.level === "block");
const warns = findings.filter((f) => f.level === "warn");

const show = (f) => `  ${f.file}${f.line ? `:${f.line}` : ""}  ${f.rule}${f.text ? `\n      ${f.text}` : ""}`;
if (warns.length) console.error(`frfro rules, worth a look:\n${warns.slice(0, 10).map(show).join("\n")}`);
if (blocks.length && !ownerOk) {
  console.error(
    `frfro rules: this change breaks ${blocks.length} hard rule(s) of CLAUDE.md. Fix them before committing` +
      ` (only if the owner explicitly asked for it, add [owner-ok] to the commit message):\n${blocks.slice(0, 20).map(show).join("\n")}`,
  );
  process.exit(hook ? 2 : 1);
}
if (blocks.length) console.error(`frfro rules: ${blocks.length} hard-rule hit(s) let through by [owner-ok].`);
if (!hook) console.log(`frfro rules: ok (${added.length} added line(s) checked).`);
