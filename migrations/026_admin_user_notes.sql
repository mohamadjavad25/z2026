-- Up Migration
-- Private admin notes about an account. (Also created lazily by app/lib/db/repos/adminOps.js.)
CREATE TABLE IF NOT EXISTS admin_user_notes (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL DEFAULT ''
);

-- Down Migration
DROP TABLE IF EXISTS admin_user_notes;
