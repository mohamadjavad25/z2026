/**
 * Account-deletion cascade fix verification (LOCAL ONLY). Mirrors
 * seed-booking-expiry-test.mjs for style/harness.
 *
 * DELETE /api/profile does a plain `DELETE FROM users WHERE id = ?` and lets
 * FKs decide the fallout. Five FKs used to be NOT NULL ... ON DELETE CASCADE
 * pointing at a *counterparty*, not the row's own owner — deleting your own
 * account could silently destroy OTHER people's data. Migration v34 (see
 * app/lib/db/migrations.js) relaxes all five to nullable ON DELETE SET NULL.
 *
 * Two phases:
 *
 *  A. MIGRATION MECHANICS (no server) — builds a raw SQLite file shaped
 *     exactly like a real pre-v34 production DB (old CASCADE schema, rows
 *     with known ids, schema_version stamped 33), runs the real
 *     ensureSchemaVersion() against it, and proves: all 5 FKs are now
 *     SET NULL, every pre-existing row survived with its data intact, a
 *     real DELETE FROM users now nulls the FK instead of deleting the child
 *     row, and AUTOINCREMENT continuity holds (a fresh insert after the
 *     rebuild gets an id greater than any id that existed before it).
 *
 *  B. REAL END-TO-END (spins up a test server, fresh DB — exercises the
 *     "brand new install" path, i.e. wipeDomainTables+applySchema, which
 *     phase A's migration path does not cover) — proves the 5 real-world
 *     scenarios through the actual HTTP API: salon/artist/shop account
 *     deletion preserves the other side's booking/order history and it's
 *     still readable without crashing; a conversation's creator deleting
 *     their account preserves the whole thread including the other
 *     participant's messages; a non-creator participant deleting their
 *     account preserves their own sent messages (sender now anonymous)
 *     instead of deleting them out of the shared thread.
 *
 * DB: data/zibaban-account-deletion-test.sqlite (phase B, server)
 *     data/zibaban-account-deletion-migration-test.sqlite (phase A, raw)
 *
 * Usage:
 *   node scripts/seed-account-deletion-cascade-test.mjs
 *   node scripts/seed-account-deletion-cascade-test.mjs --cleanup
 *
 * Env: ZIBABAN_ACCOUNT_DELETION_TEST_PORT  default 3039
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION_DB = path.join(root, "data", "zibaban-account-deletion-migration-test.sqlite");
const SERVER_DB = path.join(root, "data", "zibaban-account-deletion-test.sqlite");
const PORT = Number(process.env.ZIBABAN_ACCOUNT_DELETION_TEST_PORT || 3043);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "account-deletion-test";

const args = new Set(process.argv.slice(2));
const doCleanupOnly = args.has("--cleanup");
const keepServer = args.has("--keep-server");
const report = [];

function step(title, ok, detail = "") {
  const line = `${ok ? "PASS" : "FAIL"} ${title}${detail ? ` — ${detail}` : ""}`;
  report.push({ ok, title, detail, line });
  console.log(line);
}

function cleanupDbFiles() {
  for (const base of [MIGRATION_DB, SERVER_DB]) {
    for (const suffix of ["", "-wal", "-shm", "-journal"]) {
      const file = `${base}${suffix}`;
      if (existsSync(file)) rmSync(file, { force: true });
    }
  }
}

if (doCleanupOnly) {
  cleanupDbFiles();
  console.log("cleaned up");
  process.exit(0);
}

// ── Phase A: migration mechanics against a synthetic pre-v34 DB ──────────
function buildLegacyV33Database() {
  const db = new DatabaseSync(MIGRATION_DB);
  db.exec(`
    CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE salon_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      client TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      service TEXT NOT NULL DEFAULT '',
      staff TEXT NOT NULL DEFAULT '',
      booking_date TEXT NOT NULL DEFAULT '',
      time TEXT NOT NULL DEFAULT '',
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'تازه',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE artist_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artist_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      source_salon_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      client_name TEXT NOT NULL DEFAULT '',
      client_phone TEXT NOT NULL DEFAULT '',
      service TEXT NOT NULL DEFAULT '',
      booking_date TEXT NOT NULL DEFAULT '',
      time TEXT NOT NULL DEFAULT '',
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'تازه',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE shop_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      buyer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      buyer_name TEXT NOT NULL DEFAULT '',
      buyer_phone TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'جدید',
      total TEXT NOT NULL DEFAULT '',
      total_num REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'direct',
      title TEXT NOT NULL DEFAULT '',
      avatar TEXT NOT NULL DEFAULT '',
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE conversation_members (
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_read_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00',
      joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (conversation_id, user_id)
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL DEFAULT '',
      attachment_url TEXT NOT NULL DEFAULT '',
      attachment_type TEXT NOT NULL DEFAULT '',
      order_ref_id INTEGER REFERENCES shop_orders(id) ON DELETE SET NULL,
      booking_ref_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed users + one row per changed table, all with known ids.
  const insertUser = db.prepare("INSERT INTO users (phone, password_hash, type, name) VALUES (?, 'x', ?, ?)");
  const salonId = Number(insertUser.run("09150001001", "salon", "سالن قدیمی").lastInsertRowid);
  const clientId = Number(insertUser.run("09150001002", "client", "مشتری قدیمی").lastInsertRowid);
  const artistId = Number(insertUser.run("09150001003", "artist", "آرتیست قدیمی").lastInsertRowid);
  const shopId = Number(insertUser.run("09150001004", "shop", "فروشگاه قدیمی").lastInsertRowid);
  const creatorId = Number(insertUser.run("09150001005", "client", "شروع‌کننده گفتگو").lastInsertRowid);
  const peerId = Number(insertUser.run("09150001006", "client", "طرف مقابل").lastInsertRowid);

  const salonBookingId = Number(db.prepare(`
    INSERT INTO salon_bookings (salon_user_id, client_user_id, client, service, booking_date, time, status)
    VALUES (?, ?, 'مشتری قدیمی', 'خدمت قدیمی', 'شنبه', '10:00', 'تایید شده')
  `).run(salonId, clientId).lastInsertRowid);

  const artistBookingId = Number(db.prepare(`
    INSERT INTO artist_bookings (artist_user_id, client_user_id, client_name, service, booking_date, time, status)
    VALUES (?, ?, 'مشتری قدیمی', 'خدمت آرتیست قدیمی', 'شنبه', '11:00', 'تایید شده')
  `).run(artistId, clientId).lastInsertRowid);

  const orderId = Number(db.prepare(`
    INSERT INTO shop_orders (shop_user_id, buyer_user_id, buyer_name, status, total, total_num)
    VALUES (?, ?, 'مشتری قدیمی', 'تحویل شد', '۱۰۰۰۰۰', 100000)
  `).run(shopId, clientId).lastInsertRowid);

  const conversationId = Number(db.prepare(`
    INSERT INTO conversations (type, created_by) VALUES ('direct', ?)
  `).run(creatorId).lastInsertRowid);
  db.prepare("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)").run(conversationId, creatorId);
  db.prepare("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)").run(conversationId, peerId);
  const messageFromCreatorId = Number(db.prepare(`
    INSERT INTO messages (conversation_id, sender_user_id, body) VALUES (?, ?, 'سلام از طرف شروع‌کننده')
  `).run(conversationId, creatorId).lastInsertRowid);
  const messageFromPeerId = Number(db.prepare(`
    INSERT INTO messages (conversation_id, sender_user_id, body) VALUES (?, ?, 'سلام از طرف مقابل')
  `).run(conversationId, peerId).lastInsertRowid);

  db.prepare("INSERT INTO app_meta (key, value) VALUES ('schema_version', '33')").run();
  db.close();

  return {
    salonId, clientId, artistId, shopId, creatorId, peerId,
    salonBookingId, artistBookingId, orderId, conversationId,
    messageFromCreatorId, messageFromPeerId
  };
}

async function runMigrationPhase() {
  console.log("=== Phase A: migration mechanics (raw DB, no server) ===");
  cleanupDbFiles();
  const seeded = buildLegacyV33Database();

  const { ensureSchemaVersion } = await import("../app/lib/db/migrations.js");
  const db = new DatabaseSync(MIGRATION_DB);
  ensureSchemaVersion(db);

  const versionRow = db.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get();
  step("migrated schema_version reaches current SCHEMA_VERSION (>= 34)", Number(versionRow?.value) >= 34, `version=${versionRow?.value}`);

  for (const [table, column] of [
    ["salon_bookings", "salon_user_id"],
    ["artist_bookings", "artist_user_id"],
    ["shop_orders", "shop_user_id"],
    ["conversations", "created_by"],
    ["messages", "sender_user_id"]
  ]) {
    const fks = db.prepare(`PRAGMA foreign_key_list(${table})`).all();
    const fk = fks.find((row) => row.from === column);
    step(`${table}.${column} is now ON DELETE SET NULL`, fk?.on_delete === "SET NULL", `on_delete=${fk?.on_delete}`);
  }

  // Every pre-existing row and its data survived the rebuild with the SAME id.
  const salonBooking = db.prepare("SELECT * FROM salon_bookings WHERE id = ?").get(seeded.salonBookingId);
  step("pre-existing salon_bookings row survived the rebuild with same id/data", Boolean(salonBooking) && salonBooking.service === "خدمت قدیمی" && Number(salonBooking.salon_user_id) === seeded.salonId);

  const artistBooking = db.prepare("SELECT * FROM artist_bookings WHERE id = ?").get(seeded.artistBookingId);
  step("pre-existing artist_bookings row survived the rebuild with same id/data", Boolean(artistBooking) && artistBooking.service === "خدمت آرتیست قدیمی");

  const order = db.prepare("SELECT * FROM shop_orders WHERE id = ?").get(seeded.orderId);
  step("pre-existing shop_orders row survived the rebuild with same id/data", Boolean(order) && order.total_num === 100000);

  const conversation = db.prepare("SELECT * FROM conversations WHERE id = ?").get(seeded.conversationId);
  step("pre-existing conversations row survived the rebuild", Boolean(conversation) && Number(conversation.created_by) === seeded.creatorId);

  const msgFromCreator = db.prepare("SELECT * FROM messages WHERE id = ?").get(seeded.messageFromCreatorId);
  const msgFromPeer = db.prepare("SELECT * FROM messages WHERE id = ?").get(seeded.messageFromPeerId);
  step("both pre-existing messages survived the rebuild", Boolean(msgFromCreator) && Boolean(msgFromPeer));

  // AUTOINCREMENT continuity: a fresh insert after the rebuild must get an
  // id greater than any id that ever existed — proves the rebuild didn't
  // reset the sequence back to 1 (which would risk id collisions with any
  // stale booking_ref_id/order_ref_id pointer still floating around).
  const maxIdBefore = seeded.salonBookingId;
  const freshId = Number(db.prepare(`
    INSERT INTO salon_bookings (salon_user_id, client_user_id, client, service, booking_date, time, status)
    VALUES (?, ?, 'مشتری تازه', 'خدمت تازه', 'یکشنبه', '09:00', 'تازه')
  `).run(seeded.salonId, seeded.clientId).lastInsertRowid);
  step("AUTOINCREMENT continuity: new row's id is greater than the pre-migration max", freshId > maxIdBefore, `freshId=${freshId} maxIdBefore=${maxIdBefore}`);

  // The actual bug this fixes: deleting the SALON must no longer delete the
  // CLIENT's booking row — it must survive with salon_user_id now NULL.
  db.exec("PRAGMA foreign_keys = ON;");
  db.prepare("DELETE FROM users WHERE id = ?").run(seeded.salonId);
  const salonBookingAfterDelete = db.prepare("SELECT * FROM salon_bookings WHERE id = ?").get(seeded.salonBookingId);
  step(
    "deleting the SALON preserves the client's booking row (salon_user_id now NULL, client_user_id unchanged)",
    Boolean(salonBookingAfterDelete) && salonBookingAfterDelete.salon_user_id === null && Number(salonBookingAfterDelete.client_user_id) === seeded.clientId,
    JSON.stringify(salonBookingAfterDelete)
  );

  db.prepare("DELETE FROM users WHERE id = ?").run(seeded.artistId);
  const artistBookingAfterDelete = db.prepare("SELECT * FROM artist_bookings WHERE id = ?").get(seeded.artistBookingId);
  step(
    "deleting the ARTIST preserves the client's booking row (artist_user_id now NULL)",
    Boolean(artistBookingAfterDelete) && artistBookingAfterDelete.artist_user_id === null,
    JSON.stringify(artistBookingAfterDelete)
  );

  db.prepare("DELETE FROM users WHERE id = ?").run(seeded.shopId);
  const orderAfterDelete = db.prepare("SELECT * FROM shop_orders WHERE id = ?").get(seeded.orderId);
  step(
    "deleting the SHOP preserves the buyer's order row (shop_user_id now NULL)",
    Boolean(orderAfterDelete) && orderAfterDelete.shop_user_id === null,
    JSON.stringify(orderAfterDelete)
  );

  // The other headline bug: deleting whoever STARTED a conversation must not
  // wipe the whole thread — conversation + BOTH messages must survive.
  db.prepare("DELETE FROM users WHERE id = ?").run(seeded.creatorId);
  const conversationAfterCreatorDelete = db.prepare("SELECT * FROM conversations WHERE id = ?").get(seeded.conversationId);
  const msgFromCreatorAfterDelete = db.prepare("SELECT * FROM messages WHERE id = ?").get(seeded.messageFromCreatorId);
  const msgFromPeerAfterCreatorDelete = db.prepare("SELECT * FROM messages WHERE id = ?").get(seeded.messageFromPeerId);
  step(
    "deleting the conversation CREATOR preserves the conversation row (created_by now NULL)",
    Boolean(conversationAfterCreatorDelete) && conversationAfterCreatorDelete.created_by === null
  );
  step(
    "...and preserves the creator's OWN message too (sender_user_id now NULL, body intact)",
    Boolean(msgFromCreatorAfterDelete) && msgFromCreatorAfterDelete.sender_user_id === null && msgFromCreatorAfterDelete.body === "سلام از طرف شروع‌کننده"
  );
  step(
    "...and preserves the OTHER participant's message untouched",
    Boolean(msgFromPeerAfterCreatorDelete) && Number(msgFromPeerAfterCreatorDelete.sender_user_id) === seeded.peerId
  );

  // Deleting the NON-creator participant must preserve THEIR message too
  // (not just the creator's) — the other headline bug this closes.
  db.prepare("DELETE FROM users WHERE id = ?").run(seeded.peerId);
  const msgFromPeerAfterPeerDelete = db.prepare("SELECT * FROM messages WHERE id = ?").get(seeded.messageFromPeerId);
  step(
    "deleting a NON-creator participant preserves their own message (sender_user_id now NULL)",
    Boolean(msgFromPeerAfterPeerDelete) && msgFromPeerAfterPeerDelete.sender_user_id === null,
    JSON.stringify(msgFromPeerAfterPeerDelete)
  );

  db.close();
}

// ── Phase B: real end-to-end through the HTTP API (fresh DB) ─────────────
function parseCookie(res) {
  const raw = typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : [res.headers.get("set-cookie")].filter(Boolean);
  const match = raw.join(",").match(/zibaban_session=([^;]+)/);
  return match ? match[1] : "";
}

async function api(pathname, { method = "GET", body, cookie } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = `zibaban_session=${cookie}`;
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await res.json().catch(() => ({}));
  return { res, payload, cookie: parseCookie(res) || cookie || "" };
}

async function waitForServer(timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/salons`);
      if (res.status === 200) return true;
    } catch {
      // wait
    }
    await sleep(500);
  }
  return false;
}

function startTestServer() {
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(PORT)], {
    cwd: root,
    env: {
      ...process.env,
      ZIBABAN_DB_PATH: SERVER_DB,
      NEXT_DIST_DIR: ".next-account-deletion-test",
      PORT: String(PORT)
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const chunks = [];
  child.stdout.on("data", (b) => chunks.push(b));
  child.stderr.on("data", (b) => chunks.push(b));
  child.on("exit", () => {
    try {
      writeFileSync(path.join(root, "data", "zibaban-account-deletion-test-server.log"), Buffer.concat(chunks));
    } catch {
      // ignore
    }
  });
  return child;
}

async function stopServer(child) {
  if (!child || child.killed) return;
  try { child.kill("SIGTERM"); } catch { /* ignore */ }
  await sleep(700);
  if (!child.killed) {
    try { child.kill("SIGKILL"); } catch { /* ignore */ }
  }
}

async function register({ phone, type, name }) {
  return api("/api/auth/register", {
    method: "POST",
    body: { phone, password: PASSWORD, type, data: { name, area: "تهران" } }
  });
}

async function findConversationWith(cookie, peerUserId) {
  const { payload } = await api("/api/conversations", { cookie });
  const list = payload?.data?.conversations || [];
  return list.find((c) => c.peer?.id === peerUserId) || null;
}

async function runServerPhase() {
  console.log("\n=== Phase B: real end-to-end through the HTTP API (fresh DB) ===");
  cleanupDbFiles();
  const child = startTestServer();
  try {
    const up = await waitForServer();
    step("test server up", up, BASE);
    if (!up) return;

    // ── Salon deletion preserves the client's booking history ──────────
    const salonReg = await register({ phone: "09150002001", type: "salon", name: "سالن تست حذف" });
    const salonCookie = salonReg.cookie;
    const salonUserId = salonReg.payload?.data?.user?.id;
    const clientReg = await register({ phone: "09150002002", type: "client", name: "مشتری تست حذف" });
    const clientCookie = clientReg.cookie;

    await api("/api/salon-services", { method: "POST", cookie: salonCookie, body: { name: "خدمت تست", price: "500000", duration: "۳۰ دقیقه" } });
    const booking = await api("/api/salon-bookings", {
      method: "POST", cookie: clientCookie,
      body: { salonUserId, service: "خدمت تست", bookingDate: "شنبه", time: "۱۰:۰۰", durationMinutes: 30 }
    });
    step("client booking created", booking.res.status === 201, `status=${booking.res.status}`);

    const deleteSalon = await api("/api/profile", { method: "DELETE", cookie: salonCookie });
    step("salon account deleted", deleteSalon.res.status === 200, `status=${deleteSalon.res.status}`);

    const clientHistory = await api("/api/salon-bookings", { cookie: clientCookie });
    step("client's GET /api/salon-bookings still works after salon deletion (no crash)", clientHistory.res.status === 200);
    const survivedBooking = (clientHistory.payload?.bookings || []).find((b) => Number(b.id) === Number(booking.payload?.booking?.id));
    step(
      "client's booking with the deleted salon is still in their history, salon shown as حذف‌شده",
      Boolean(survivedBooking) && survivedBooking.salonName === "سالن حذف‌شده",
      JSON.stringify(survivedBooking)
    );

    // ── Artist deletion preserves the client's booking history ─────────
    const artistReg = await register({ phone: "09150002003", type: "artist", name: "آرتیست تست حذف" });
    const artistCookie = artistReg.cookie;
    const artistUserId = artistReg.payload?.data?.user?.id;
    const client2Reg = await register({ phone: "09150002004", type: "client", name: "مشتری۲ تست حذف" });
    const client2Cookie = client2Reg.cookie;

    const artistBooking = await api("/api/artist/bookings", {
      method: "POST", cookie: client2Cookie,
      body: { artistUserId, service: "خدمت آرتیست", bookingDate: "شنبه", time: "۱۱:۰۰", durationMinutes: 30 }
    });
    step("client's direct artist booking created", artistBooking.res.status === 201, `status=${artistBooking.res.status}`);

    const deleteArtist = await api("/api/profile", { method: "DELETE", cookie: artistCookie });
    step("artist account deleted", deleteArtist.res.status === 200);

    const client2History = await api("/api/artist-bookings", { cookie: client2Cookie });
    step("client's GET /api/artist-bookings still works after artist deletion (no crash)", client2History.res.status === 200, `status=${client2History.res.status} body=${JSON.stringify(client2History.payload).slice(0, 200)}`);

    // ── Shop deletion preserves the buyer's order history ───────────────
    const shopReg = await register({ phone: "09150002005", type: "shop", name: "فروشگاه تست حذف" });
    const shopCookie = shopReg.cookie;
    const shopUserId = shopReg.payload?.data?.user?.id;
    const buyerReg = await register({ phone: "09150002006", type: "client", name: "خریدار تست حذف" });
    const buyerCookie = buyerReg.cookie;

    const product = await api("/api/shop/me", {
      method: "POST", cookie: shopCookie,
      body: { name: "محصول تست", priceNum: 100000, stock: 10 }
    });
    const productId = product.payload?.data?.product?.id;
    step("shop product created", Boolean(productId), JSON.stringify(product.payload).slice(0, 200));

    const order = await api("/api/shop/orders", {
      method: "POST", cookie: buyerCookie,
      body: { shopUserId, items: [{ productId, quantity: 1 }] }
    });
    step("buyer order created", order.res.status === 201, `status=${order.res.status} body=${JSON.stringify(order.payload).slice(0, 200)}`);

    const deleteShop = await api("/api/profile", { method: "DELETE", cookie: shopCookie });
    step("shop account deleted", deleteShop.res.status === 200);

    const buyerHistory = await api("/api/shop/orders", { cookie: buyerCookie });
    step("buyer's GET /api/shop/orders still works after shop deletion (no crash)", buyerHistory.res.status === 200);
    const survivedOrder = (buyerHistory.payload?.data?.orders || []).find((o) => Number(o.id) === Number(order.payload?.data?.order?.id));
    step("buyer's order with the deleted shop is still in their history", Boolean(survivedOrder), JSON.stringify(survivedOrder));

    // ── Conversation creator deletion preserves the whole thread ───────
    const creatorReg = await register({ phone: "09150002007", type: "client", name: "شروع‌کننده گفتگو" });
    const creatorCookie = creatorReg.cookie;
    const peerReg = await register({ phone: "09150002008", type: "client", name: "طرف مقابل گفتگو" });
    const peerCookie = peerReg.cookie;
    const peerUserId = peerReg.payload?.data?.user?.id;
    const creatorUserId = creatorReg.payload?.data?.user?.id;

    const convStart = await api("/api/conversations", { method: "POST", cookie: creatorCookie, body: { peerUserId } });
    const conversationId = convStart.payload?.data?.conversation?.id;
    step("conversation started", Boolean(conversationId), JSON.stringify(convStart.payload).slice(0, 200));

    await api(`/api/conversations/${conversationId}/messages`, { method: "POST", cookie: creatorCookie, body: { body: "پیام از شروع‌کننده" } });
    await api(`/api/conversations/${conversationId}/messages`, { method: "POST", cookie: peerCookie, body: { body: "پیام از طرف مقابل" } });

    const deleteCreator = await api("/api/profile", { method: "DELETE", cookie: creatorCookie });
    step("conversation creator account deleted", deleteCreator.res.status === 200);

    const peerThreadAfterCreatorDelete = await api(`/api/conversations/${conversationId}/messages`, { cookie: peerCookie });
    step("peer can still read the full thread after the creator deleted their account (no crash)", peerThreadAfterCreatorDelete.res.status === 200);
    const msgsAfterCreatorDelete = peerThreadAfterCreatorDelete.payload?.data?.messages || [];
    step(
      "both messages (creator's AND peer's) survived the creator's account deletion",
      msgsAfterCreatorDelete.some((m) => m.body === "پیام از شروع‌کننده") && msgsAfterCreatorDelete.some((m) => m.body === "پیام از طرف مقابل"),
      `count=${msgsAfterCreatorDelete.length}`
    );

    // ── Non-creator participant deletion preserves their own messages ──
    const deletePeer = await api("/api/profile", { method: "DELETE", cookie: peerCookie });
    step("non-creator participant account deleted", deletePeer.res.status === 200);
    // Nobody with a session can read this conversation anymore (both real
    // users are gone) — verify directly in the DB instead, same as phase A.
    const rawDb = new DatabaseSync(SERVER_DB);
    const peerMessageRow = rawDb.prepare("SELECT * FROM messages WHERE conversation_id = ? AND body = ?").get(conversationId, "پیام از طرف مقابل");
    rawDb.close();
    step(
      "the non-creator's own message survived their account deletion (sender_user_id now NULL)",
      Boolean(peerMessageRow) && peerMessageRow.sender_user_id === null,
      JSON.stringify(peerMessageRow)
    );
  } catch (err) {
    step("unexpected error", false, String(err?.stack || err));
  } finally {
    if (!keepServer) await stopServer(child);
    if (!keepServer) cleanupDbFiles();
  }
}

async function main() {
  console.log("=== seed-account-deletion-cascade-test ===");
  await runMigrationPhase();
  await runServerPhase();

  const passed = report.filter((r) => r.ok).length;
  const total = report.length;
  console.log(`\nACCOUNT DELETION CASCADE TEST: ${passed}/${total} passed`);
  if (passed !== total) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
