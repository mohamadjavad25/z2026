import { applySchema } from "./schema.js";

const SCHEMA_VERSION = 30;

/** Convert legacy session expiry strings (ISO / SQLite datetime) to epoch ms. Unparseable → 0 (expired). */
export function sessionExpiryToEpochMs(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 0;
    // Already ms (≥ ~2001-09 in ms) or seconds (≥ ~2001-09 in s).
    if (n >= 1e12) return Math.floor(n);
    if (n >= 1e9) return Math.floor(n * 1000);
    return 0;
  }

  if (raw.includes("T") || /Z$/i.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw)) {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const sqliteMatch = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/
  );
  if (sqliteMatch) {
    const epoch = Date.UTC(
      Number(sqliteMatch[1]),
      Number(sqliteMatch[2]) - 1,
      Number(sqliteMatch[3]),
      Number(sqliteMatch[4]),
      Number(sqliteMatch[5]),
      Number(sqliteMatch[6])
    );
    return Number.isFinite(epoch) ? epoch : 0;
  }

  const fallback = Date.parse(raw);
  return Number.isFinite(fallback) ? fallback : 0;
}

function migrateSessionsExpiresToEpoch(database) {
  if (!tableExists(database, "sessions")) return;
  const rows = database.prepare("SELECT token, expires_at FROM sessions").all();
  const update = database.prepare("UPDATE sessions SET expires_at = ? WHERE token = ?");
  for (const row of rows) {
    update.run(String(sessionExpiryToEpochMs(row.expires_at)), row.token);
  }
}

function tableExists(database, name) {
  return Boolean(
    database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name)
  );
}

function columnExists(database, table, column) {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((col) => col.name === column);
}

function wipeDomainTables(database) {
  const tables = database.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'app_meta'
  `).all();
  database.exec("PRAGMA foreign_keys = OFF;");
  for (const table of tables) {
    database.exec(`DROP TABLE IF EXISTS "${table.name}";`);
  }
  database.exec("PRAGMA foreign_keys = ON;");
}

function migrateToV3(database) {
  if (!tableExists(database, "wallets")) {
    applySchema(database);
    return;
  }

  if (!columnExists(database, "wallets", "available_balance")) {
    database.exec("ALTER TABLE wallets ADD COLUMN available_balance INTEGER NOT NULL DEFAULT 0;");
  }
  if (!columnExists(database, "wallets", "pending_balance")) {
    database.exec("ALTER TABLE wallets ADD COLUMN pending_balance INTEGER NOT NULL DEFAULT 0;");
  }

  if (tableExists(database, "wallet_transactions")) {
    if (!columnExists(database, "wallet_transactions", "currency")) {
      database.exec("ALTER TABLE wallet_transactions ADD COLUMN currency TEXT NOT NULL DEFAULT 'shell';");
    }
    if (!columnExists(database, "wallet_transactions", "type")) {
      database.exec("ALTER TABLE wallet_transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'adjustment';");
    }
    if (!columnExists(database, "wallet_transactions", "status")) {
      database.exec("ALTER TABLE wallet_transactions ADD COLUMN status TEXT NOT NULL DEFAULT 'posted';");
    }
    if (!columnExists(database, "wallet_transactions", "ref_type")) {
      database.exec("ALTER TABLE wallet_transactions ADD COLUMN ref_type TEXT NOT NULL DEFAULT '';");
    }
    if (!columnExists(database, "wallet_transactions", "ref_id")) {
      database.exec("ALTER TABLE wallet_transactions ADD COLUMN ref_id TEXT NOT NULL DEFAULT '';");
    }
    if (!columnExists(database, "wallet_transactions", "balance_after")) {
      database.exec("ALTER TABLE wallet_transactions ADD COLUMN balance_after INTEGER NOT NULL DEFAULT 0;");
    }
  }

  applySchema(database);
}

function migrateToV4(database) {
  migrateToV3(database);
  if (tableExists(database, "posts") && !columnExists(database, "posts", "views_count")) {
    database.exec("ALTER TABLE posts ADD COLUMN views_count INTEGER NOT NULL DEFAULT 0;");
  }
  applySchema(database);
}

function migrateToV5(database) {
  migrateToV4(database);
  if (tableExists(database, "salon_services") && !columnExists(database, "salon_services", "staff_id")) {
    database.exec("ALTER TABLE salon_services ADD COLUMN staff_id INTEGER;");
  }
  applySchema(database);
}

function migrateToV6(database) {
  migrateToV5(database);
  if (tableExists(database, "salon_services") && !columnExists(database, "salon_services", "staff_ids")) {
    database.exec("ALTER TABLE salon_services ADD COLUMN staff_ids TEXT NOT NULL DEFAULT '';");
  }
  applySchema(database);
}

function migrateToV7(database) {
  migrateToV6(database);
  if (tableExists(database, "salon_services") && !columnExists(database, "salon_services", "hint")) {
    database.exec("ALTER TABLE salon_services ADD COLUMN hint TEXT NOT NULL DEFAULT '';");
  }
  applySchema(database);
}

function migrateToV8(database) {
  migrateToV7(database);
  applySchema(database);
}

function migrateToV9(database) {
  migrateToV8(database);
  if (tableExists(database, "salon_bookings") && !columnExists(database, "salon_bookings", "client_user_id")) {
    database.exec("ALTER TABLE salon_bookings ADD COLUMN client_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;");
  }
  applySchema(database);
}

function migrateToV10(database) {
  migrateToV9(database);
  migrateSessionsExpiresToEpoch(database);
  applySchema(database);
}

/**
 * Rebuild wallets with non-negative CHECK constraints.
 * SQLite cannot ADD CHECK via ALTER TABLE on existing schemas.
 */
function migrateWalletsBalanceChecks(database) {
  if (!tableExists(database, "wallets")) {
    applySchema(database);
    return;
  }

  // Clamp legacy negatives before enforcing CHECK.
  database.exec(`
    UPDATE wallets SET shell_balance = 0 WHERE shell_balance < 0;
    UPDATE wallets SET available_balance = 0 WHERE available_balance < 0;
    UPDATE wallets SET pending_balance = 0 WHERE pending_balance < 0;
  `);

  database.exec("PRAGMA foreign_keys = OFF;");
  database.exec(`
    CREATE TABLE IF NOT EXISTS wallets_v11 (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      shell_balance INTEGER NOT NULL DEFAULT 0 CHECK (shell_balance >= 0),
      available_balance INTEGER NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
      pending_balance INTEGER NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  database.exec(`
    INSERT OR REPLACE INTO wallets_v11 (user_id, shell_balance, available_balance, pending_balance, updated_at)
    SELECT user_id, shell_balance, available_balance, pending_balance, updated_at FROM wallets;
  `);
  database.exec("DROP TABLE wallets;");
  database.exec("ALTER TABLE wallets_v11 RENAME TO wallets;");
  database.exec("PRAGMA foreign_keys = ON;");
}

function migrateToV11(database) {
  migrateToV10(database);
  migrateWalletsBalanceChecks(database);
  applySchema(database);
}

/**
 * Salon booking conflict fix:
 * - duration_minutes column
 * - normalize stored times to Latin HH:MM
 * - backfill duration from salon_services when possible
 */
function migrateSalonBookingConflictColumns(database) {
  if (!tableExists(database, "salon_bookings")) {
    applySchema(database);
    return;
  }

  if (!columnExists(database, "salon_bookings", "duration_minutes")) {
    database.exec(
      "ALTER TABLE salon_bookings ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 60;"
    );
  }

  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  const toLatin = (value) => String(value || "").replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)));
  const normalizeTime = (value) => {
    const [h = "0", m = "0"] = toLatin(value).split(":");
    const hours = Number(h) || 0;
    const minutes = Number(m) || 0;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };
  const parseDuration = (value) => {
    const match = toLatin(value).match(/(\d+)/);
    return Math.max(15, Number(match?.[1] || 60));
  };

  const serviceDurations = new Map();
  if (tableExists(database, "salon_services")) {
    for (const row of database.prepare("SELECT salon_user_id, name, duration FROM salon_services").all()) {
      serviceDurations.set(
        `${row.salon_user_id}::${String(row.name || "").trim()}`,
        parseDuration(row.duration)
      );
    }
  }

  const rows = database.prepare("SELECT id, salon_user_id, service, time, duration_minutes FROM salon_bookings").all();
  const update = database.prepare(
    "UPDATE salon_bookings SET time = ?, duration_minutes = ? WHERE id = ?"
  );
  for (const row of rows) {
    const normalizedTime = normalizeTime(row.time);
    const fromService = serviceDurations.get(`${row.salon_user_id}::${String(row.service || "").trim()}`);
    const duration = Math.max(15, Number(row.duration_minutes) || fromService || 60);
    if (normalizedTime !== row.time || duration !== Number(row.duration_minutes)) {
      update.run(normalizedTime, duration, row.id);
    }
  }

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_salon_bookings_day
    ON salon_bookings (salon_user_id, booking_date, status);
  `);
}

function migrateToV12(database) {
  migrateToV11(database);
  migrateSalonBookingConflictColumns(database);
  applySchema(database);
}

function migrateToV13(database) {
  migrateToV12(database);
  if (tableExists(database, "users") && !columnExists(database, "users", "experience_years")) {
    database.exec("ALTER TABLE users ADD COLUMN experience_years TEXT NOT NULL DEFAULT '';");
  }
  applySchema(database);
}

function migrateToV14(database) {
  migrateToV13(database);
  if (tableExists(database, "users") && !columnExists(database, "users", "manager_name")) {
    database.exec("ALTER TABLE users ADD COLUMN manager_name TEXT NOT NULL DEFAULT '';");
  }
  applySchema(database);
}

function migrateToV15(database) {
  migrateToV14(database);
  if (!tableExists(database, "profile_stories")) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS profile_stories (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        video TEXT NOT NULL DEFAULT '',
        poster TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
  applySchema(database);
}

function migrateToV16(database) {
  migrateToV15(database);
  if (tableExists(database, "post_ratings") && !columnExists(database, "post_ratings", "comment")) {
    database.exec("ALTER TABLE post_ratings ADD COLUMN comment TEXT NOT NULL DEFAULT '';");
  }
  applySchema(database);
}

function migrateToV17(database) {
  migrateToV16(database);
  if (tableExists(database, "reviews")) {
    if (!columnExists(database, "reviews", "reply_text")) {
      database.exec("ALTER TABLE reviews ADD COLUMN reply_text TEXT NOT NULL DEFAULT '';");
    }
    if (!columnExists(database, "reviews", "replied_at")) {
      database.exec("ALTER TABLE reviews ADD COLUMN replied_at TEXT;");
    }
  }
  applySchema(database);
}

function migrateToV18(database) {
  migrateToV17(database);
  if (tableExists(database, "shop_products") && !columnExists(database, "shop_products", "featured")) {
    database.exec("ALTER TABLE shop_products ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;");
  }
  applySchema(database);
}

/** New wallet_idempotency_keys table only — applySchema's CREATE TABLE IF NOT EXISTS covers it. */
function migrateToV19(database) {
  migrateToV18(database);
  applySchema(database);
}

/** Read-tracking columns on conversations, so unread counts reflect real per-side "last seen" state. */
function migrateToV20(database) {
  migrateToV19(database);
  if (tableExists(database, "conversations")) {
    if (!columnExists(database, "conversations", "a_last_read_at")) {
      database.exec("ALTER TABLE conversations ADD COLUMN a_last_read_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';");
    }
    if (!columnExists(database, "conversations", "b_last_read_at")) {
      database.exec("ALTER TABLE conversations ADD COLUMN b_last_read_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';");
    }
  }
  applySchema(database);
}

/** New user_settings table only — applySchema's CREATE TABLE IF NOT EXISTS covers it. */
function migrateToV21(database) {
  migrateToV20(database);
  applySchema(database);
}

/**
 * New shop_categories table, backfilled from every distinct category string
 * already sitting on shop_products — existing products must not silently
 * lose their category grouping once categories become a real owned list.
 */
function migrateToV22(database) {
  migrateToV21(database);
  applySchema(database);
  const shops = database.prepare("SELECT DISTINCT shop_user_id FROM shop_products").all();
  const insertCategory = database.prepare(`
    INSERT OR IGNORE INTO shop_categories (shop_user_id, name) VALUES (?, ?)
  `);
  for (const { shop_user_id: shopUserId } of shops) {
    const categories = database.prepare(`
      SELECT category FROM shop_products
      WHERE shop_user_id = ? AND TRIM(COALESCE(category, '')) != ''
      GROUP BY category
      ORDER BY MIN(id)
    `).all(shopUserId);
    categories.forEach(({ category }) => insertCategory.run(shopUserId, category));
  }
}

/**
 * Explicit sort_order on shop_categories — lets an owner reorder their rows
 * instead of being stuck with creation order forever. Backfilled from the
 * existing id order so nothing visibly reshuffles on upgrade.
 */
function migrateToV23(database) {
  migrateToV22(database);
  if (tableExists(database, "shop_categories") && !columnExists(database, "shop_categories", "sort_order")) {
    database.exec("ALTER TABLE shop_categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;");
    const rows = database.prepare("SELECT id, shop_user_id FROM shop_categories ORDER BY shop_user_id, id").all();
    const update = database.prepare("UPDATE shop_categories SET sort_order = ? WHERE id = ?");
    let position = 0;
    let lastShopId = null;
    for (const row of rows) {
      if (row.shop_user_id !== lastShopId) {
        position = 0;
        lastShopId = row.shop_user_id;
      }
      update.run(position, row.id);
      position += 1;
    }
  }
}

/** shop_promo_cards: one selectable/configurable card per shop, shown on both the owner dashboard and the public storefront. */
function migrateToV24(database) {
  migrateToV23(database);
  if (!tableExists(database, "shop_promo_cards")) {
    database.exec(`
      CREATE TABLE shop_promo_cards (
        shop_user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        card_type TEXT NOT NULL,
        primary_text TEXT NOT NULL DEFAULT '',
        secondary_text TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
}

/** shop_promo_cards: from one row per shop to a real owned list — own icon/color per card, several saved, one marked active. */
function migrateToV25(database) {
  migrateToV24(database);
  const hasNewShape = tableExists(database, "shop_promo_cards") && columnExists(database, "shop_promo_cards", "icon_key");
  if (hasNewShape) return;

  const CARD_TYPE_TO_ICON_TONE = {
    discount: { icon: "percent", tone: "gold" },
    shipping: { icon: "truck", tone: "info" },
    announcement: { icon: "megaphone", tone: "wine" },
    bestseller: { icon: "award", tone: "success" }
  };

  const oldRows = tableExists(database, "shop_promo_cards")
    ? database.prepare("SELECT shop_user_id, card_type, primary_text, secondary_text FROM shop_promo_cards").all()
    : [];

  database.exec("DROP TABLE IF EXISTS shop_promo_cards;");
  database.exec(`
    CREATE TABLE shop_promo_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      icon_key TEXT NOT NULL,
      tone TEXT NOT NULL,
      primary_text TEXT NOT NULL DEFAULT '',
      secondary_text TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const insert = database.prepare(`
    INSERT INTO shop_promo_cards (shop_user_id, icon_key, tone, primary_text, secondary_text, is_active, sort_order)
    VALUES (?, ?, ?, ?, ?, 1, 0)
  `);
  for (const row of oldRows) {
    const meta = CARD_TYPE_TO_ICON_TONE[row.card_type] || { icon: "star", tone: "wine" };
    insert.run(row.shop_user_id, meta.icon, meta.tone, row.primary_text, row.secondary_text);
  }
}

/**
 * Messaging rebuild: conversations gain type/title/avatar and membership
 * moves into its own table (conversation_members), so a "direct" (2-person)
 * and a "group" (N-person, named) conversation share one model instead of
 * the old fixed a_user_id/b_user_id pair. messages gains attachment columns.
 * Existing direct conversations + their messages are preserved with their
 * original ids so nothing already-linked breaks.
 */
function migrateToV26(database) {
  migrateToV25(database);
  const hasNewShape = tableExists(database, "conversations") && columnExists(database, "conversations", "type");
  if (hasNewShape) return;

  const oldConversations = tableExists(database, "conversations")
    ? database.prepare("SELECT id, a_user_id, b_user_id, a_last_read_at, b_last_read_at, created_at, updated_at FROM conversations").all()
    : [];
  const oldMessages = tableExists(database, "messages")
    ? database.prepare("SELECT id, conversation_id, sender_user_id, body, created_at FROM messages").all()
    : [];

  database.exec("PRAGMA foreign_keys = OFF;");
  database.exec("DROP TABLE IF EXISTS messages;");
  database.exec("DROP TABLE IF EXISTS conversation_members;");
  database.exec("DROP TABLE IF EXISTS conversations;");

  database.exec(`
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
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_conversation_members_user ON conversation_members(user_id);
    CREATE INDEX idx_messages_conversation ON messages(conversation_id, id);
  `);
  database.exec("PRAGMA foreign_keys = ON;");

  const insertConversation = database.prepare(`
    INSERT INTO conversations (id, type, title, avatar, created_by, created_at, updated_at)
    VALUES (?, 'direct', '', '', ?, ?, ?)
  `);
  const insertMember = database.prepare(`
    INSERT INTO conversation_members (conversation_id, user_id, last_read_at)
    VALUES (?, ?, ?)
  `);
  for (const row of oldConversations) {
    insertConversation.run(row.id, row.a_user_id, row.created_at, row.updated_at);
    insertMember.run(row.id, row.a_user_id, row.a_last_read_at);
    insertMember.run(row.id, row.b_user_id, row.b_last_read_at);
  }

  const insertMessage = database.prepare(`
    INSERT INTO messages (id, conversation_id, sender_user_id, body, attachment_url, attachment_type, created_at)
    VALUES (?, ?, ?, ?, '', '', ?)
  `);
  for (const row of oldMessages) {
    insertMessage.run(row.id, row.conversation_id, row.sender_user_id, row.body, row.created_at);
  }
}

/** messages.order_ref_id: lets a message be an "order card" (receipt + live status) linking to a real shop_orders row. */
function migrateToV27(database) {
  migrateToV26(database);
  if (tableExists(database, "messages") && !columnExists(database, "messages", "order_ref_id")) {
    database.exec("ALTER TABLE messages ADD COLUMN order_ref_id INTEGER REFERENCES shop_orders(id) ON DELETE SET NULL;");
  }
}

/** New shop_stock_movements table only — applySchema's CREATE TABLE IF NOT EXISTS covers it. */
function migrateToV28(database) {
  migrateToV27(database);
  applySchema(database);
}

/** New shop_order_idempotency_keys table only — applySchema's CREATE TABLE IF NOT EXISTS covers it. */
function migrateToV29(database) {
  migrateToV28(database);
  applySchema(database);
}

/**
 * Drop wallets.shell_balance: the in-app "shell" currency and the AI Studio
 * feature that spent it were removed from the product (frontend + API).
 * shell_balance has been dead/unread by app code for a while — nothing
 * writes or reads it anymore (see app/lib/db/repos/wallet.js, app/api/wallet
 * route). available_balance/pending_balance (the real Toman wallet) are a
 * separate pair of columns on the same row and are left untouched.
 * SQLite ALTER TABLE can't DROP COLUMN on every version we might run on, so
 * rebuild the table the same way migrateWalletsBalanceChecks (v11) did.
 */
function migrateDropShellBalance(database) {
  if (!tableExists(database, "wallets")) {
    applySchema(database);
    return;
  }
  if (!columnExists(database, "wallets", "shell_balance")) return;

  database.exec("PRAGMA foreign_keys = OFF;");
  database.exec(`
    CREATE TABLE wallets_v30 (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      available_balance INTEGER NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
      pending_balance INTEGER NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  database.exec(`
    INSERT INTO wallets_v30 (user_id, available_balance, pending_balance, updated_at)
    SELECT user_id, available_balance, pending_balance, updated_at FROM wallets;
  `);
  database.exec("DROP TABLE wallets;");
  database.exec("ALTER TABLE wallets_v30 RENAME TO wallets;");
  database.exec("PRAGMA foreign_keys = ON;");
}

function migrateToV30(database) {
  migrateToV29(database);
  migrateDropShellBalance(database);
  applySchema(database);
}

function readSchemaVersion(database) {
  const row = database.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get();
  return Number(row?.value || 0);
}

function writeSchemaVersion(database, version) {
  database.prepare(`
    INSERT INTO app_meta (key, value) VALUES ('schema_version', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(String(version));
}

/** Ordered steps from the lowest defined migrator up to SCHEMA_VERSION. */
const MIGRATION_STEPS = [
  { version: 3, migrate: migrateToV3 },
  { version: 4, migrate: migrateToV4 },
  { version: 5, migrate: migrateToV5 },
  { version: 6, migrate: migrateToV6 },
  { version: 7, migrate: migrateToV7 },
  { version: 8, migrate: migrateToV8 },
  { version: 9, migrate: migrateToV9 },
  { version: 10, migrate: migrateToV10 },
  { version: 11, migrate: migrateToV11 },
  { version: 12, migrate: migrateToV12 },
  { version: 13, migrate: migrateToV13 },
  { version: 14, migrate: migrateToV14 },
  { version: 15, migrate: migrateToV15 },
  { version: 16, migrate: migrateToV16 },
  { version: 17, migrate: migrateToV17 },
  { version: 18, migrate: migrateToV18 },
  { version: 19, migrate: migrateToV19 },
  { version: 20, migrate: migrateToV20 },
  { version: 21, migrate: migrateToV21 },
  { version: 22, migrate: migrateToV22 },
  { version: 23, migrate: migrateToV23 },
  { version: 24, migrate: migrateToV24 },
  { version: 25, migrate: migrateToV25 },
  { version: 26, migrate: migrateToV26 },
  { version: 27, migrate: migrateToV27 },
  { version: 28, migrate: migrateToV28 },
  { version: 29, migrate: migrateToV29 },
  { version: 30, migrate: migrateToV30 }
];

export function ensureSchemaVersion(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  let current = readSchemaVersion(database);
  const hasLegacyProfiles = tableExists(database, "profiles");

  // Only wipe truly incompatible legacy demos.
  if (hasLegacyProfiles || current === 0) {
    wipeDomainTables(database);
    applySchema(database);
    writeSchemaVersion(database, SCHEMA_VERSION);
    return;
  }

  for (const step of MIGRATION_STEPS) {
    if (current >= step.version) continue;
    try {
      step.migrate(database);
      current = step.version;
      writeSchemaVersion(database, current);
    } catch (error) {
      // Keep the last successfully stamped version in app_meta; do not jump to TARGET.
      throw error;
    }
  }

  applySchema(database);
}
