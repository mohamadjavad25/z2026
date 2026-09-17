
import { ensureDb, getDb } from "../app/lib/db/connection.js";
ensureDb();
const db = getDb();
console.log("salons cols:", db.prepare("PRAGMA table_info(salons)").all().map(c => c.name).join(","));
console.log("shops cols:", db.prepare("PRAGMA table_info(shops)").all().map(c => c.name).join(","));
