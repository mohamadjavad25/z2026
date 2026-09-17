
/**
 * Phase-2 temporary seed: adds 6 products + 1 review to shop loiih (user 10).
 * --cleanup removes them.
 */
import { ensureDb, getDb } from "../app/lib/db/connection.js";
ensureDb();
const db = getDb();
const cleanup = process.argv.includes("--cleanup");

const products = [
  ["رژ لب مات", "میکاپ", "450000", 450000, "جدید"],
  ["پالت سایه", "میکاپ", "780000", 780000, "پرفروش"],
  ["کرم ضد آفتاب", "پوست", "320000", 320000, ""],
  ["سرم تقویت مژه", "پوست", "540000", 540000, "ویژه"],
  ["شامپو حجم‌دهنده", "مو", "280000", 280000, ""],
  ["ماسک مو کراتینه", "مو", "390000", 390000, "تخفیف"]
];

if (cleanup) {
  const delP = db.prepare("DELETE FROM shop_products WHERE id > 2 AND shop_user_id = 10").run();
  const delR = db.prepare("DELETE FROM reviews WHERE id > 1").run();
  const delF = db.prepare("DELETE FROM follows WHERE follower_user_id = 11 AND target_user_id = 10").run();
  console.log("cleanup done:", JSON.stringify({ products: delP.changes, reviews: delR.changes, follows: delF.changes }));
} else {
  const ins = db.prepare("INSERT INTO shop_products (shop_user_id, name, category, price, price_num, stock, badge, image, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 10, ?, '/explore-post-makeup-nude.png', ?, datetime('now'), datetime('now'))");
  for (const [name, cat, price, priceNum, badge] of products) {
    ins.run(10, name, cat, price, priceNum, badge, "محصول تست فاز ۲");
  }
  const insR = db.prepare("INSERT INTO reviews (target_user_id, author_user_id, author_name, rating, text, service, created_at) VALUES (10, 11, 'نگار محمدی', 5, 'کیفیت عالی بود، بسته‌بندی مرتب و ارسال سریع. حتماً دوباره خرید می‌کنم.', 'خرید آنلاین', datetime('now'))");
  insR.run();
  console.log("seeded: 6 products + 1 review for loiih (user 10)");
}
