import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { ensureSchemaVersion } from "../app/lib/db/migrations.js";

function columnNames(database, table) {
  return database.prepare(`PRAGMA table_info(${table})`).all().map((col) => col.name);
}

function buildFakeSchemaV6(database) {
  database.exec(`
    CREATE TABLE app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE wallets (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      shell_balance INTEGER NOT NULL DEFAULT 0,
      available_balance INTEGER NOT NULL DEFAULT 0,
      pending_balance INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      tag TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL DEFAULT '',
      caption TEXT NOT NULL DEFAULT '',
      in_explore INTEGER NOT NULL DEFAULT 1,
      featured INTEGER NOT NULL DEFAULT 0,
      saves_count INTEGER NOT NULL DEFAULT 0,
      views_count INTEGER NOT NULL DEFAULT 0,
      comments_count INTEGER NOT NULL DEFAULT 0,
      rating_avg REAL NOT NULL DEFAULT 0,
      rating_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- v6 shape: staff_id + staff_ids present, hint absent
    CREATE TABLE salon_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price TEXT NOT NULL DEFAULT '',
      duration TEXT NOT NULL DEFAULT '',
      staff_id INTEGER,
      staff_ids TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- v6 shape: client_user_id absent
    CREATE TABLE salon_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      service TEXT NOT NULL DEFAULT '',
      staff TEXT NOT NULL DEFAULT '',
      booking_date TEXT NOT NULL DEFAULT '',
      time TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'تازه',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  database.prepare(`
    INSERT INTO app_meta (key, value) VALUES ('schema_version', '6')
  `).run();

  database.prepare(`
    INSERT INTO users (id, phone, password_hash, type, name)
    VALUES (1, '09120000006', 'salt:hash', 'client', 'کاربر v6')
  `).run();

  database.prepare(`
    INSERT INTO wallets (user_id, shell_balance, available_balance, pending_balance)
    VALUES (1, 0, 0, 0)
  `).run();

  const futureIso = "2099-06-15T12:00:00.000Z";
  const pastIso = "2020-01-01T00:00:00.000Z";
  database.prepare(`
    INSERT INTO sessions (token, user_id, expires_at) VALUES (?, 1, ?)
  `).run("tok-future", futureIso);
  database.prepare(`
    INSERT INTO sessions (token, user_id, expires_at) VALUES (?, 1, ?)
  `).run("tok-past", pastIso);

  database.prepare(`
    INSERT INTO salon_services (salon_user_id, name, staff_id, staff_ids)
    VALUES (1, 'ژلیش', 1, '1')
  `).run();

  database.prepare(`
    INSERT INTO salon_bookings (salon_user_id, client, time)
    VALUES (1, 'مینا', '۱۰:۰۰')
  `).run();

  return { futureIso, pastIso };
}

test("ensureSchemaVersion runs V7→V11 sequentially from schema_version=6", () => {
  const database = new DatabaseSync(":memory:");
  const { futureIso, pastIso } = buildFakeSchemaV6(database);

  assert.equal(
    database.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get().value,
    "6"
  );
  assert.equal(columnNames(database, "salon_services").includes("hint"), false);
  assert.equal(columnNames(database, "salon_bookings").includes("client_user_id"), false);

  ensureSchemaVersion(database);

  const version = database.prepare(
    "SELECT value FROM app_meta WHERE key = 'schema_version'"
  ).get().value;
  assert.equal(version, "30", "final schema_version must be 30 (ensureSchemaVersion runs every defined step, not just up to v11)");

  // v7: hint column
  assert.ok(
    columnNames(database, "salon_services").includes("hint"),
    "migrateToV7 must add salon_services.hint"
  );

  // v8: no new column — still at 11 means V8 step ran without blocking the chain
  // v9: client_user_id
  assert.ok(
    columnNames(database, "salon_bookings").includes("client_user_id"),
    "migrateToV9 must add salon_bookings.client_user_id"
  );

  // v10: session expires_at converted to epoch ms
  const futureRow = database.prepare(
    "SELECT expires_at FROM sessions WHERE token = ?"
  ).get("tok-future");
  const pastRow = database.prepare(
    "SELECT expires_at FROM sessions WHERE token = ?"
  ).get("tok-past");

  assert.equal(futureRow.expires_at, String(Date.parse(futureIso)));
  assert.equal(pastRow.expires_at, String(Date.parse(pastIso)));
  assert.match(String(futureRow.expires_at), /^\d{13,}$/);
  assert.ok(Number(futureRow.expires_at) > Date.now());
  assert.ok(Number(pastRow.expires_at) < Date.now());

  // v11: wallets balance CHECKs (>= 0)
  const walletSql = database
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='wallets'")
    .get()?.sql || "";
  assert.match(walletSql, /available_balance[^,]*CHECK \(available_balance >= 0\)/i);
  assert.match(walletSql, /pending_balance[^,]*CHECK \(pending_balance >= 0\)/i);

  // v30: shell_balance dropped (shell currency / AI Studio removed) — the
  // real Toman wallet columns (available_balance/pending_balance) survive untouched.
  assert.equal(
    columnNames(database, "wallets").includes("shell_balance"),
    false,
    "migrateToV30 must drop wallets.shell_balance"
  );
  assert.ok(
    columnNames(database, "wallets").includes("available_balance"),
    "migrateToV30 must not touch wallets.available_balance"
  );
  assert.ok(
    columnNames(database, "wallets").includes("pending_balance"),
    "migrateToV30 must not touch wallets.pending_balance"
  );
});
