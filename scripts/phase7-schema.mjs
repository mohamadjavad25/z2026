
import { ensureDb, getDb } from "../app/lib/db/connection.js";
ensureDb();
const db = getDb();
console.log("shops cols:", db.prepare("PRAGMA table_info(shops)").all().map(c => c.name).join(","));
