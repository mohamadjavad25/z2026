
import { ensureDb, getDb } from "../app/lib/db/connection.js";
ensureDb();
const db = getDb();
const rows = db.prepare("SELECT user_id, length(video) AS vlen, length(poster) AS plen, updated_at FROM profile_stories").all();
console.log("DB ROWS:", JSON.stringify(rows));
