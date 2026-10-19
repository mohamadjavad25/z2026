-- Up Migration
-- Push to the private «فرفرو مدیر» Android app (ir.frfro.admin, never in a store), kept apart from
-- the users' app tokens in native_push_tokens so admin news never lands in someone's normal app and a
-- normal app token never counts as "the admin has the admin app". The app sends its token after every
-- admin login; it stays when the short admin session ends, so news still arrives. An admin with a fresh
-- row here gets support and payment news as a push only, without the SMS. See app/lib/adminPush.js.
CREATE TABLE IF NOT EXISTS admin_push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_push_tokens_user ON admin_push_tokens(user_id);

-- Down Migration
DROP TABLE IF EXISTS admin_push_tokens;
