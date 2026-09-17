
import { ensureDb, getDb } from "../app/lib/db/connection.js";
ensureDb();
const db = getDb();
console.log("TABLES:", db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name).join(","));
console.log("users cols:", db.prepare("PRAGMA table_info(users)").all().map(c => c.name).join(","));
// artist storage?
console.log("artists table?:", !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='artists'").get());
if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='artists'").get()) {
  console.log("artists cols:", db.prepare("PRAGMA table_info(artists)").all().map(c => c.name).join(","));
}
