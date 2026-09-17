
import { ensureDb, getDb } from "../app/lib/db/connection.js";
ensureDb();
const db = getDb();
if (process.argv.includes("--cleanup")) { db.prepare("DELETE FROM profile_stories WHERE user_id = 12").run(); console.log("cleaned"); }
else { db.prepare("INSERT INTO profile_stories (user_id, video, poster, updated_at) VALUES (12, '', '/explore-post-makeup-nude.png', datetime('now')) ON CONFLICT(user_id) DO UPDATE SET poster = excluded.poster, video = excluded.video, updated_at = excluded.updated_at").run(); console.log("seeded"); }
