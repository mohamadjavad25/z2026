
import { ensureDb, getDb } from "../app/lib/db/connection.js";
ensureDb();
const db = getDb();
console.log("P:", JSON.stringify(db.prepare("SELECT id, shop_user_id, name, price, price_num, category, badge, stock FROM shop_products").all()));
console.log("R:", JSON.stringify(db.prepare("SELECT id, target_user_id, author_name, rating, text FROM reviews").all()));
console.log("U:", JSON.stringify(db.prepare("SELECT id, phone, name, type FROM users").all()));
console.log("F:", JSON.stringify(db.prepare("SELECT * FROM follows").all()));
