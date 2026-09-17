
import { ensureDb, getDb } from "../app/lib/db/connection.js";
ensureDb();
const db = getDb();
if (process.argv.includes("--cleanup")) {
  const r = db.prepare("DELETE FROM posts WHERE id > 9").run();
  console.log("cleanup:", r.changes);
} else {
  db.prepare("INSERT INTO posts (owner_user_id, title, tag, image, caption, in_explore, featured, saves_count, comments_count, rating_avg, rating_count, created_at, updated_at, views_count) VALUES (12, 'استوری تست', 'میکاپ', '/explore-post-makeup-nude.png', 'تست استوری آرتیست', 1, 0, 0, 0, 0, 0, datetime('now'), datetime('now'), 0)").run();
  console.log("post for artist 12 created");
}
