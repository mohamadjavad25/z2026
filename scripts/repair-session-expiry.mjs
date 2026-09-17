/**
 * One-off repair: convert legacy sessions.expires_at (ISO / SQLite datetime)
 * to epoch milliseconds — same helper as migrateToV10.
 *
 * Default: dry-run (read-only, no writes).
 * Apply:   node scripts/repair-session-expiry.mjs --apply
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { sessionExpiryToEpochMs } from "../app/lib/db/migrations.js";

// Same path resolution as app/lib/db/connection.js
const dataDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data"
);
const dbPath = path.join(dataDir, "zibaban.sqlite");

const apply = process.argv.includes("--apply");

function isCanonicalEpochMs(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return false;
  return String(sessionExpiryToEpochMs(raw)) === raw;
}

/** Row needs repair when stored text is not already the canonical epoch-ms string. */
function needsRepair(expiresAt) {
  return !isCanonicalEpochMs(expiresAt);
}

function openDb({ readOnly }) {
  if (!existsSync(dbPath)) {
    throw new Error(`Database not found: ${dbPath}`);
  }
  const database = new DatabaseSync(dbPath, readOnly ? { readOnly: true } : {});
  // Match connection.js pragmas (skip schema migration — this is a one-off repair).
  if (!readOnly) {
    database.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  }
  return database;
}

function planRepairs(database) {
  const rows = database.prepare("SELECT token, user_id, expires_at FROM sessions").all();
  const changes = [];
  for (const row of rows) {
    if (!needsRepair(row.expires_at)) continue;
    const next = String(sessionExpiryToEpochMs(row.expires_at));
    changes.push({
      token: row.token,
      user_id: row.user_id,
      from: row.expires_at,
      to: next,
      parseFailed: next === "0" && String(row.expires_at ?? "").trim() !== "0"
    });
  }
  return { total: rows.length, changes };
}

function verifyNoLegacy(database) {
  const rows = database.prepare("SELECT token, expires_at FROM sessions").all();
  const leftover = rows.filter((row) => needsRepair(row.expires_at));
  return { total: rows.length, leftover };
}

function main() {
  console.log("=== repair-session-expiry (one-off) ===");
  console.log(`DB: ${dbPath}`);
  console.log(`Mode: ${apply ? "APPLY (writes enabled)" : "DRY-RUN (no writes)"}`);
  console.log("");

  const database = openDb({ readOnly: !apply });

  try {
    const { total, changes } = planRepairs(database);

    console.log(`sessions rows: ${total}`);
    console.log(`rows needing repair: ${changes.length}`);
    console.log("");

    if (changes.length === 0) {
      console.log("چیزی برای ترمیم نبود — همه expires_at از قبل epoch عددی هستند.");
      return;
    }

    for (const item of changes) {
      const tokenPreview = `${String(item.token).slice(0, 12)}…`;
      const flag = item.parseFailed ? " [parse→0 expired]" : "";
      console.log(`- token=${tokenPreview} user_id=${item.user_id}`);
      console.log(`    from: ${item.from}`);
      console.log(`    to:   ${item.to}${flag}`);
    }

    if (!apply) {
      console.log("");
      console.log("Dry-run کامل شد. برای نوشتن واقعی دوباره با --apply اجرا کن.");
      return;
    }

    const update = database.prepare(
      "UPDATE sessions SET expires_at = ? WHERE token = ?"
    );
    const tx = database.transaction((items) => {
      for (const item of items) {
        update.run(item.to, item.token);
      }
    });
    tx(changes);

    console.log("");
    console.log(`اعمال شد: ${changes.length} ردیف در یک تراکنش به‌روز شد.`);

    const { leftover } = verifyNoLegacy(database);
    if (leftover.length === 0) {
      console.log("✓ تأیید: صفر ردیف باقی‌مانده با expires_at غیرepoch.");
    } else {
      console.log(`✗ هنوز ${leftover.length} ردیف غیرepoch باقی است:`);
      for (const row of leftover.slice(0, 5)) {
        console.log(`    ${row.expires_at}`);
      }
      process.exitCode = 1;
    }
  } finally {
    database.close();
  }
}

main();
