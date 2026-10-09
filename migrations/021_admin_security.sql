-- Up Migration
-- Separate, hardened admin login: authenticator-app (TOTP) secret per admin and short-lived admin-only sessions.
-- admin_totp.secret_enc is AES-256-GCM encrypted with a key derived from FARFAROO_ADMIN_SECRET (never stored in plain text).
-- admin_sessions stores only a SHA-256 of the cookie token, so a database leak cannot be replayed as a login.
CREATE TABLE IF NOT EXISTS admin_totp (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret_enc TEXT NOT NULL,
  enabled_at TIMESTAMPTZ,                    -- NULL while enrollment is still pending confirmation
  last_step BIGINT NOT NULL DEFAULT 0,       -- last accepted 30-second step: a code can never be used twice
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ua_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions (user_id);

-- Down Migration
DROP TABLE IF EXISTS admin_sessions;
DROP TABLE IF EXISTS admin_totp;
