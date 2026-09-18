/**
 * Isolated race test for saved_profiles / toggleSaveProfile() (LOCAL ONLY).
 *
 * Verifies that rapidly double-clicking "save" on a salon/artist profile
 * (social.toggleSaveProfile) can never create a duplicate saved_profiles
 * row, throw a UNIQUE-constraint crash, or leave the table in an
 * inconsistent state -- including under REAL concurrency: two worker_threads,
 * each with its OWN node:sqlite connection to the same file (same pattern as
 * the shop-order-idempotency and wallet race tests), hammering
 * toggleSaveProfile() for the same (user, target) pair at the same time.
 *
 * Uses a separate SQLite file (never data/zibaban.sqlite):
 *   data/zibaban-saved-profile-race-test.sqlite
 *
 * Usage:
 *   node scripts/seed-saved-profile-race-test.mjs
 *   node scripts/seed-saved-profile-race-test.mjs --cleanup
 */
import { DatabaseSync } from "node:sqlite";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-saved-profile-race-test.sqlite");

const args = new Set(process.argv.slice(2));
const doCleanupOnly = args.has("--cleanup");

const report = [];
function step(title, ok, detail = "") {
  const line = `${ok ? "✓" : "✗"} ${title}${detail ? ` — ${detail}` : ""}`;
  report.push({ ok, title, detail, line });
  console.log(line);
}

function cleanupDbFiles() {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const file = `${TEST_DB}${suffix}`;
    if (existsSync(file)) rmSync(file, { force: true });
  }
}

/**
 * Runs social.toggleSaveProfile() `count` times in a tight loop inside its
 * own worker thread, with its own node:sqlite connection to `dbPath` (set
 * via ZIBABAN_DB_PATH before the repo module is imported). Mirrors
 * runWorkerCreateOrder in seed-shop-idempotency-test.mjs.
 */
function runWorkerToggleLoop({ dbPath, userId, targetUserId, count }) {
  const workerSource = `
    import { parentPort, workerData } from "node:worker_threads";
    process.env.ZIBABAN_DB_PATH = workerData.dbPath;
    const social = await import(${JSON.stringify(pathToFileURL(path.join(root, "app/lib/db/repos/social.js")).href)});
    try {
      const results = [];
      for (let i = 0; i < workerData.count; i++) {
        results.push(social.toggleSaveProfile(workerData.userId, workerData.targetUserId));
      }
      parentPort.postMessage({ ok: true, results });
    } catch (error) {
      parentPort.postMessage({ ok: false, error: error?.code || "error", detail: String(error?.message || error) });
    }
  `;
  const tmp = path.join(root, "data", `saved-profile-race-worker-${process.pid}-${Math.random().toString(16).slice(2)}.mjs`);
  writeFileSync(tmp, workerSource);
  return new Promise((resolve) => {
    const worker = new Worker(tmp, {
      workerData: { dbPath, userId, targetUserId, count },
      type: "module"
    });
    worker.on("message", (msg) => {
      try { rmSync(tmp, { force: true }); } catch { /* ignore */ }
      resolve(msg);
    });
    worker.on("error", (err) => {
      try { rmSync(tmp, { force: true }); } catch { /* ignore */ }
      resolve({ ok: false, error: "worker_error", detail: String(err?.message || err) });
    });
  });
}

async function main() {
  console.log("=== saved_profiles toggle race test (isolated DB) ===");
  console.log(`TEST_DB: ${TEST_DB}`);
  console.log("");

  if (doCleanupOnly) {
    cleanupDbFiles();
    step("cleanup test DB files", true, TEST_DB);
    console.log("\nDone. Main DB data/zibaban.sqlite was not touched.");
    return;
  }

  cleanupDbFiles();
  step("prepare empty test DB path", true, "deleted previous test sqlite if any");

  process.env.ZIBABAN_DB_PATH = TEST_DB;
  const { ensureDb } = await import(pathToFileURL(path.join(root, "app/lib/db/connection.js")).href);
  const { createUser } = await import(pathToFileURL(path.join(root, "app/lib/db/repos/users.js")).href);
  const social = await import(pathToFileURL(path.join(root, "app/lib/db/repos/social.js")).href);

  ensureDb();
  step("run migrations on fresh isolated DB (through schema_version 33)", true);

  const client = createUser({
    phone: "09120003331", passwordHash: "x", type: "client", name: "کاربر تست ذخیره"
  });
  const salon = createUser({
    phone: "09120003332", passwordHash: "x", type: "salon", name: "سالن تست ذخیره"
  });
  const userId = client.id;
  const targetUserId = salon.id;
  step("seed a client + a salon user", Boolean(userId) && Boolean(targetUserId), `userId=${userId} targetUserId=${targetUserId}`);

  try {
    // 1) Sequential correctness: save -> unsave -> save
    const r1 = social.toggleSaveProfile(userId, targetUserId);
    step("1. first toggle saves (saved=true)", r1.ok && r1.saved === true, JSON.stringify(r1));
    const rowsAfter1 = new DatabaseSync(TEST_DB)
      .prepare("SELECT COUNT(*) AS n FROM saved_profiles WHERE user_id = ? AND target_user_id = ?")
      .get(userId, targetUserId).n;
    step("1b. exactly one row after first save", rowsAfter1 === 1, `rows=${rowsAfter1}`);

    const r2 = social.toggleSaveProfile(userId, targetUserId);
    step("2. second toggle unsaves (saved=false)", r2.ok && r2.saved === false, JSON.stringify(r2));
    const rowsAfter2 = new DatabaseSync(TEST_DB)
      .prepare("SELECT COUNT(*) AS n FROM saved_profiles WHERE user_id = ? AND target_user_id = ?")
      .get(userId, targetUserId).n;
    step("2b. zero rows after unsave", rowsAfter2 === 0, `rows=${rowsAfter2}`);

    // 2) Self-save is rejected, not silently accepted
    const rSelf = social.toggleSaveProfile(userId, userId);
    step("3. self-save is rejected (ok:false, error:'self')", rSelf.ok === false && rSelf.error === "self", JSON.stringify(rSelf));

    // 3) Real concurrency: two worker_threads, each with its OWN node:sqlite
    // connection, each hammering toggleSaveProfile() 25 times back-to-back
    // for the SAME (user, target) pair at the same time -- this is what a
    // user frantically double/triple-clicking "save" looks like from the
    // DB's point of view, except worse (genuinely parallel, not just two
    // requests on one event loop).
    const perWorker = 25;
    const [raceA, raceB] = await Promise.all([
      runWorkerToggleLoop({ dbPath: TEST_DB, userId, targetUserId, count: perWorker }),
      runWorkerToggleLoop({ dbPath: TEST_DB, userId, targetUserId, count: perWorker })
    ]);
    step(
      "4. worker_threads race (separate DB connections, 25x25 rapid toggles) -> neither worker crashed",
      Boolean(raceA?.ok) && Boolean(raceB?.ok),
      `okA=${raceA?.ok} okB=${raceB?.ok} errA=${raceA?.error || ""} errB=${raceB?.error || ""} detailA=${raceA?.detail || ""} detailB=${raceB?.detail || ""}`
    );

    const raceCheckDb = new DatabaseSync(TEST_DB);
    const raceRows = Number(
      raceCheckDb.prepare("SELECT COUNT(*) AS n FROM saved_profiles WHERE user_id = ? AND target_user_id = ?").get(userId, targetUserId)?.n || 0
    );
    raceCheckDb.close();
    step(
      "4b. after the race, saved_profiles has 0 or 1 row for the pair -- NEVER duplicated",
      raceRows === 0 || raceRows === 1,
      `rows=${raceRows} (0 or 1 both count as sane end states for a flip-flop toggle)`
    );

    // 4) Whatever the race left it at, one more toggle deterministically
    // flips it and the table still never exceeds 1 row -- proves the PK is
    // doing its job and nothing is left half-broken after the stress run.
    const rFinal = social.toggleSaveProfile(userId, targetUserId);
    const finalRows = new DatabaseSync(TEST_DB)
      .prepare("SELECT COUNT(*) AS n FROM saved_profiles WHERE user_id = ? AND target_user_id = ?")
      .get(userId, targetUserId).n;
    step(
      "5. post-race toggle still behaves (ok, and table stays at exactly 0 or 1 row)",
      rFinal.ok && (finalRows === 0 || finalRows === 1),
      `result=${JSON.stringify(rFinal)} rows=${finalRows}`
    );
  } catch (error) {
    step("suite aborted", false, error.message || String(error));
    process.exitCode = 1;
  }

  console.log("\n--- summary ---");
  const failed = report.filter((r) => !r.ok).length;
  console.log(`passed=${report.length - failed} failed=${failed}`);
  console.log(`test DB file: ${TEST_DB}`);
  console.log("main DB untouched: data/zibaban.sqlite");
  console.log("rollback: node scripts/seed-saved-profile-race-test.mjs --cleanup");

  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
