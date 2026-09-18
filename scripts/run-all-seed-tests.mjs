/**
 * Aggregator for the scripts/seed-*-test.mjs isolated smoke/regression tests
 * that accumulated this session (real dev-server + isolated SQLite DB per
 * script, each on its own port/dist-dir so they never collide). Previously
 * there was no single documented way to run them all — each had to be found
 * and invoked by hand. Runs them one at a time (sequential, not parallel —
 * several boot a real `next dev`/`next start` server and matching a real
 * project boot is slow but safe; running many at once risks resource
 * contention on a dev machine even though ports don't collide).
 *
 * Usage:
 *   node scripts/run-all-seed-tests.mjs            # run every seed-*-test.mjs
 *   node scripts/run-all-seed-tests.mjs shop wallet # only run scripts whose
 *                                                    # filename contains "shop" or "wallet"
 *
 * Exit code is 0 only if every selected script exited 0. Each script's own
 * stdout/stderr is streamed live (prefixed) so failures are diagnosable
 * without re-running by hand.
 *
 * NOTE: on a genuine crash/interruption (Ctrl+C, OOM, etc.) an individual
 * script may leave its own isolated data/*.sqlite[-wal|-shm] file behind —
 * see KNOWN_ISSUES.md / each script's own `--cleanup` flag. This aggregator
 * does not attempt cross-script cleanup; it only reports pass/fail.
 */
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const filters = process.argv.slice(2).map((f) => f.toLowerCase());

const allFiles = readdirSync(scriptsDir)
  .filter((f) => /^seed-.*-test\.mjs$/.test(f))
  .sort();

const files = filters.length
  ? allFiles.filter((f) => filters.some((filter) => f.toLowerCase().includes(filter)))
  : allFiles;

if (files.length === 0) {
  console.error(filters.length
    ? `No seed-*-test.mjs files matched filter(s): ${filters.join(", ")}`
    : "No seed-*-test.mjs files found in scripts/.");
  process.exit(1);
}

console.log(`Running ${files.length} test script(s) sequentially:\n${files.map((f) => `  - ${f}`).join("\n")}\n`);

function runOne(file) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [path.join(scriptsDir, file)], {
      stdio: "inherit",
      env: process.env
    });
    child.on("exit", (code) => {
      resolve({ file, code: code ?? 1, ms: Date.now() - startedAt });
    });
    child.on("error", (err) => {
      console.error(`[${file}] failed to start: ${err.message}`);
      resolve({ file, code: 1, ms: Date.now() - startedAt });
    });
  });
}

const results = [];
for (const file of files) {
  console.log(`\n=== ${file} ===`);
  // eslint-disable-next-line no-await-in-loop -- intentionally sequential, see module docstring
  const result = await runOne(file);
  results.push(result);
}

console.log("\n=== Summary ===");
let failed = 0;
for (const { file, code, ms } of results) {
  const status = code === 0 ? "PASS" : "FAIL";
  if (code !== 0) failed += 1;
  console.log(`${status.padEnd(4)} ${file}  (${(ms / 1000).toFixed(1)}s, exit ${code})`);
}

if (failed > 0) {
  console.log(`\n${failed}/${results.length} script(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\nAll ${results.length} script(s) passed.`);
}
