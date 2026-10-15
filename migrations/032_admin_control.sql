-- Up Migration
-- The admin's control room: site-wide settings the operator changes without a deploy (notice banner, pause sign-ups,
-- saved support replies), a record of every broadcast message, and browser crash reports kept for the health page.
-- (Also created lazily by app/lib/db/repos/adminControl.js so a deploy never needs a manual database step.)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS admin_broadcasts (
  id SERIAL PRIMARY KEY,
  segment TEXT NOT NULL,
  channels TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  recipients INTEGER NOT NULL DEFAULT 0,
  inboxed INTEGER NOT NULL DEFAULT 0,
  pushed INTEGER NOT NULL DEFAULT 0,
  admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  admin_label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_broadcasts_created ON admin_broadcasts (created_at DESC);

CREATE TABLE IF NOT EXISTS client_errors (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  stack TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_errors_created ON client_errors (created_at DESC);

-- Audit log filters (by person and by action) on a table that only grows.
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions (target_user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_action ON admin_actions (action, id DESC);

-- Down Migration
DROP INDEX IF EXISTS idx_admin_actions_action;
DROP INDEX IF EXISTS idx_admin_actions_target;
DROP TABLE IF EXISTS client_errors;
DROP TABLE IF EXISTS admin_broadcasts;
DROP TABLE IF EXISTS app_settings;
