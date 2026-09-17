
import { ensureDb, getDb } from "../app/lib/db/connection.js";
ensureDb();
const db = getDb();
const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='profile_stories'").get();
console.log("table:", t ? "OK" : "MISSING");
console.log("cols:", db.prepare("PRAGMA table_info(profile_stories)").all().map(c => c.name).join(","));
