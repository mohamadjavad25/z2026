
import { ensureDb, getDb } from "../app/lib/db/connection.js";
ensureDb();
const db = getDb();
if (process.argv.includes("--cleanup")) { db.prepare("DELETE FROM profile_stories WHERE user_id = 14").run(); console.log("cleaned"); }
else { db.prepare("INSERT INTO profile_stories (user_id, video, poster, updated_at) VALUES (14, 'data:video/mp4;base64,AAAA', '', datetime('now')) ON CONFLICT(user_id) DO UPDATE SET video = excluded.video, poster = excluded.poster, updated_at = excluded.updated_at").run(); console.log("seeded shop story"); }
