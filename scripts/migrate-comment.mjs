import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("data/zibaban.sqlite");
db.exec("PRAGMA busy_timeout = 8000;");
try { db.exec("PRAGMA journal_mode = WAL;"); } catch {}
const cols = db.prepare("PRAGMA table_info(post_ratings)").all();
if (!cols.some((c) => c.name === "comment")) {
  db.exec("ALTER TABLE post_ratings ADD COLUMN comment TEXT NOT NULL DEFAULT '';");
  console.log("comment column added");
} else {
  console.log("comment column exists");
}
const rows = db.prepare("SELECT user_id, post_id, rating, comment FROM post_ratings LIMIT 5").all();
console.log(JSON.stringify(rows));
db.close();
