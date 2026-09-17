
import { ensureDb, getDb } from "../app/lib/db/connection.js";
ensureDb();
const db = getDb();
if (process.argv.includes("--cleanup")) {
  const r = db.prepare("DELETE FROM reviews WHERE id > 1").run();
  const f = db.prepare("DELETE FROM follows WHERE follower_user_id = 11 AND target_user_id = 10").run();
  console.log("cleanup:", JSON.stringify({ reviews: r.changes, follows: f.changes }));
} else {
  db.prepare("INSERT INTO reviews (target_user_id, author_user_id, author_name, rating, text, service, created_at) VALUES (10, 11, 'نگار محمدی', 5, 'کیفیت عالی بود.', 'خرید آنلاین', datetime('now'))").run();
  console.log("seeded 1 review for loiih");
}
