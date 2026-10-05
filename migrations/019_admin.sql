-- Up Migration
-- Suspension (blocks login and kills existing sessions) and an audit trail of every admin action.
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS admin_actions (
  id SERIAL PRIMARY KEY,
  admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  admin_label TEXT NOT NULL DEFAULT '',      -- phone of the admin, or 'token' for the API token path
  action TEXT NOT NULL,                      -- 'suspend' | 'unsuspend' | 'resolve_password_reset'
  target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions (created_at DESC);

-- Down Migration
DROP TABLE IF EXISTS admin_actions;
ALTER TABLE users DROP COLUMN IF EXISTS suspended_at;
