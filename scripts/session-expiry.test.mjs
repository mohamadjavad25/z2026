import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";

import { ensureDb, getDb } from "../app/lib/db/connection.js";
import { createSession, getValidSession, deleteSession } from "../app/lib/db/repos/sessions.js";
import { createSessionForUser } from "../app/lib/auth.js";
import { hashPassword } from "../app/lib/auth.js";
import * as users from "../app/lib/db/repos/users.js";

test("getValidSession rejects sessions whose expires_at is in the past", () => {
  ensureDb();
  const db = getDb();

  const phone = `09${Date.now().toString().slice(-9)}`;
  const user = users.createUser({
    phone,
    passwordHash: hashPassword("session-expiry-test"),
    type: "client",
    name: "سشن تست"
  });

  const expiredToken = randomBytes(16).toString("hex");
  const validToken = randomBytes(16).toString("hex");
  const pastMs = Date.now() - 60_000;
  const futureMs = Date.now() + 60_000;

  createSession(expiredToken, user.id, pastMs);
  createSession(validToken, user.id, futureMs);

  try {
    assert.equal(getValidSession(expiredToken), null, "past epoch must be invalid");
    assert.ok(getValidSession(validToken), "future epoch must be valid");

    // Legacy ISO string that is already past — after v10 migration rows are epoch,
    // but also guard direct inserts of old format during transition.
    const legacyToken = randomBytes(16).toString("hex");
    const pastIso = new Date(Date.now() - 60_000).toISOString();
    db.prepare(`
      INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)
    `).run(legacyToken, user.id, pastIso);
    // Without CAST-to-epoch, ISO vs CURRENT_TIMESTAMP was the bug. Numeric compare of
    // a non-numeric ISO via CAST(... AS INTEGER) yields 0, which is not > now → invalid.
    assert.equal(
      getValidSession(legacyToken),
      null,
      "unmigrated past ISO string must not validate against numeric now"
    );
    deleteSession(legacyToken);

    const fresh = createSessionForUser(user.id);
    assert.equal(typeof fresh.expiresAt, "number");
    assert.ok(fresh.expiresAt > Date.now());
    assert.ok(getValidSession(fresh.token));
    deleteSession(fresh.token);
  } finally {
    deleteSession(expiredToken);
    deleteSession(validToken);
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
  }
});
