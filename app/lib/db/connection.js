import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { ensureSchemaVersion } from "./migrations.js";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "data");
mkdirSync(dataDir, { recursive: true });

const defaultDbPath = path.join(dataDir, "zibaban.sqlite");
/** Optional override for isolated local/test DBs (never point this at prod casually). */
export const dbPath = process.env.ZIBABAN_DB_PATH
  ? path.resolve(process.env.ZIBABAN_DB_PATH)
  : defaultDbPath;

mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new DatabaseSync(dbPath);

let ready = false;

/**
 * node:sqlite DatabaseSync has no better-sqlite3-style db.transaction().
 * Use explicit BEGIN / COMMIT / ROLLBACK instead.
 */
export function withTransaction(database, fn) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // ignore rollback errors if no active transaction
    }
    throw error;
  }
}

export function ensureDb() {
  if (ready) return db;
  db.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  try {
    db.exec("PRAGMA journal_mode = WAL;");
  } catch {
    // WAL may be unavailable on some VFS / :memory: setups; busy_timeout still applies.
  }
  ensureSchemaVersion(db);
  ready = true;
  return db;
}

export function getDb() {
  return ensureDb();
}
