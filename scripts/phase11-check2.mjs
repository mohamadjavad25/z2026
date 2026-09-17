
import { ensureDb, getDb } from "../app/lib/db/connection.js";
ensureDb();
const db = getDb();
console.log("rows:", JSON.stringify(db.prepare("SELECT user_id, length(video) v FROM profile_stories").all()));
