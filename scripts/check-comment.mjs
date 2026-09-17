import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("data/zibaban.sqlite");
db.exec("PRAGMA busy_timeout = 5000;");
const rows = db.prepare("SELECT r.user_id, r.post_id, r.rating, r.comment, u.phone FROM post_ratings r JOIN users u ON u.id = r.user_id WHERE r.comment != '' ORDER BY r.updated_at DESC LIMIT 5").all();
console.log(JSON.stringify(rows, null, 1));
const recent = db.prepare("SELECT r.user_id, r.post_id, r.rating, r.comment, u.phone FROM post_ratings r JOIN users u ON u.id = r.user_id ORDER BY r.updated_at DESC LIMIT 3").all();
console.log("recent:", JSON.stringify(recent));
db.close();
