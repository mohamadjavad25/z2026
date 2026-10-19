-- Up Migration
-- Push inside the frfro Android app (Firebase Cloud Messaging), next to the browser's Web Push in
-- push_subscriptions. One row per installed app: the app sends its token every time it opens
-- (last_seen_at), and drops it on logout or when notifications are turned off. A user with a fresh
-- row here gets booking and subscription news as a push only; everyone else (iPhone and other
-- browsers, phones without Google services, the old app) also gets the SMS. See app/lib/push.js.
CREATE TABLE IF NOT EXISTS native_push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'android',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_native_push_tokens_user ON native_push_tokens(user_id);

-- Down Migration
DROP TABLE IF EXISTS native_push_tokens;
