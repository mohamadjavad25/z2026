
import { ensureDb, getDb } from "../app/lib/db/connection.js";
ensureDb();
const db = getDb();
// simulate what listSalons does: join + storyFieldsFor
import { listSalons } from "../app/lib/db/repos/salons.js";
try {
  const list = listSalons();
  console.log("count:", list.length);
  const sizes = list.map((s) => ({ id: s.id, keys: Object.keys(s).length, jsonLen: JSON.stringify(s).length }));
  console.log("sizes:", JSON.stringify(sizes));
} catch (e) {
  console.log("ERROR:", e.message, e.stack?.slice(0, 500));
}
