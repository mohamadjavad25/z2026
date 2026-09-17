
import { ensureDb, getDb } from "../app/lib/db/connection.js";
ensureDb();
const db = getDb();
console.log("posts:", JSON.stringify(db.prepare("SELECT id, owner_user_id, title, tag, in_explore FROM posts ORDER BY id DESC LIMIT 8").all()));
console.log("user 12:", JSON.stringify(db.prepare("SELECT id, name, type FROM users WHERE id = 12").all()));
