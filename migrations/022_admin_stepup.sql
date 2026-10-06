-- Up Migration
-- Dangerous admin actions (delete account, delete post, ...) need a recent password re-check: stepup_until marks the window.
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS stepup_until TIMESTAMPTZ;

-- Down Migration
ALTER TABLE admin_sessions DROP COLUMN IF EXISTS stepup_until;
