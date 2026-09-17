import { ensureDb, getDb } from "../app/lib/db/connection.js";
import { hashPassword, verifyPassword, createSessionForUser, publicUser } from "../app/lib/auth.js";
import * as users from "../app/lib/db/repos/users.js";
import * as posts from "../app/lib/db/repos/posts.js";
import * as shops from "../app/lib/db/repos/shops.js";
import * as artists from "../app/lib/db/repos/artists.js";

ensureDb();
const db = getDb();

const counts = {
  users: db.prepare("SELECT COUNT(*) AS c FROM users").get().c,
  posts: db.prepare("SELECT COUNT(*) AS c FROM posts").get().c,
  shops: db.prepare("SELECT COUNT(*) AS c FROM shops").get().c,
  salons: db.prepare("SELECT COUNT(*) AS c FROM salons").get().c
};
console.log("empty-start counts", counts);

const phone = `09${Date.now().toString().slice(-9)}`;
const artist = users.createUser({
  phone,
  passwordHash: hashPassword("password123"),
  type: "artist",
  name: "آرتیست تست",
  area: "جردن",
  service: "میکاپ"
});
console.log("artist", publicUser(artist));
console.log("password ok", verifyPassword("password123", artist.password_hash));

const session = createSessionForUser(artist.id);
console.log("session", Boolean(session?.token));

const post = posts.createPost(artist.id, {
  title: "میکاپ نود تست",
  tag: "میکاپ",
  caption: "نمونه",
  image: "/explore-post-makeup-nude.png",
  inExplore: true
});
console.log("post", post.id, post.salon);

artists.addArtistService(artist.id, { name: "میکاپ نود", price: "۲ م", duration: "۹۰ دقیقه" });
console.log("services", artists.listArtistServices(artist.id).length);
console.log("explore", posts.listExplorePosts().length);

const shopPhone = `09${(Date.now() + 1).toString().slice(-9)}`;
const shopUser = users.createUser({
  phone: shopPhone,
  passwordHash: hashPassword("password123"),
  type: "shop",
  name: "فروشگاه تست",
  area: "سعادت‌آباد",
  service: "میکاپ"
});
shops.addProduct(shopUser.id, { name: "رژ", category: "میکاپ", price: "۱۰۰ ه", priceNum: 100000, stock: 5 });
console.log("shops", shops.listShops().length, "products", shops.listProducts(shopUser.id).length);

console.log("OK smoke");
