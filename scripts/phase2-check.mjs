
import { ensureDb, getDb } from "../app/lib/db/connection.js";
ensureDb();
const db = getDb();
console.log("products:", JSON.stringify(db.prepare("SELECT id, shop_user_id, name FROM shop_products").all()));
console.log("reviews:", JSON.stringify(db.prepare("SELECT id, target_user_id, author_name FROM reviews").all()));
console.log("follows:", JSON.stringify(db.prepare("SELECT * FROM follows WHERE follower_user_id = 11").all()));
