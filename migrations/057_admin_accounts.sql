-- Up Migration
-- The admin panel gets its own accounts, apart from the app's users (owner's decision 2026-10-27, after deleting the
-- app account behind the admin phone locked the panel). An admin is a phone listed in FRFRO_ADMIN_PHONES with its own
-- password and authenticator here; an app account with the same phone may exist or not, and deleting it changes nothing.
-- setup_* hold a setup that has started but whose first code was not typed yet, so starting a setup never locks the
-- current password and authenticator out. totp_secret_enc / setup_secret_enc are encrypted as in 021_admin_security.sql.
-- The old admin_totp and admin_sessions tables are left in place (unused) so the previous release still runs on a rollback.
CREATE TABLE IF NOT EXISTS admin_accounts (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  totp_secret_enc TEXT,
  totp_enabled_at TIMESTAMPTZ,
  totp_last_step BIGINT NOT NULL DEFAULT 0,
  setup_secret_enc TEXT,
  setup_password_hash TEXT,
  setup_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_account_sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
  ua_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  stepup_until TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_admin_account_sessions_admin ON admin_account_sessions (admin_id);

-- Admins who already have a working authenticator keep it, and keep their current password as the admin password.
INSERT INTO admin_accounts (phone, password_hash, totp_secret_enc, totp_enabled_at, totp_last_step)
SELECT u.phone, u.password_hash, t.secret_enc, t.enabled_at, t.last_step
FROM admin_totp t JOIN users u ON u.id = t.user_id
WHERE t.enabled_at IS NOT NULL AND u.phone IS NOT NULL
ON CONFLICT (phone) DO NOTHING;

-- The «فرفرو مدیر» app's tokens now belong to the admin account.
ALTER TABLE admin_push_tokens ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES admin_accounts(id) ON DELETE CASCADE;
ALTER TABLE admin_push_tokens ALTER COLUMN user_id DROP NOT NULL;
UPDATE admin_push_tokens p SET admin_id = a.id
FROM users u JOIN admin_accounts a ON a.phone = u.phone
WHERE p.user_id = u.id AND p.admin_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_admin_push_tokens_admin ON admin_push_tokens (admin_id);

-- Down Migration
DROP INDEX IF EXISTS idx_admin_push_tokens_admin;
DELETE FROM admin_push_tokens WHERE user_id IS NULL;
ALTER TABLE admin_push_tokens ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE admin_push_tokens DROP COLUMN IF EXISTS admin_id;
DROP TABLE IF EXISTS admin_account_sessions;
DROP TABLE IF EXISTS admin_accounts;
