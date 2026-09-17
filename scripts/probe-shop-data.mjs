import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("data/zibaban.sqlite");
db.exec("PRAGMA busy_timeout = 5000;");
const shops = db.prepare("SELECT id, name, area, service, type FROM users WHERE type = ?").all("shop");
console.log("shops:", JSON.stringify(shops));
if (shops.length) {
  const id = shops[0].id;
  const products = db.prepare("SELECT COUNT(*) AS c FROM shop_products WHERE shop_user_id = ?").get(id);
  const followers = db.prepare("SELECT COUNT(*) AS c FROM follows WHERE target_user_id = ?").get(id);
  console.log("first shop products/followers:", JSON.stringify(products), JSON.stringify(followers));
}
db.close();
