
import { ensureDb, getDb } from "../app/lib/db/connection.js";
ensureDb();
const db = getDb();
const r = db.prepare("DELETE FROM profile_stories").run();
console.log("cleaned:", r.changes, "rows");
