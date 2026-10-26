-- Up Migration
-- «همکاری تموم شد» as a card inside the app (owner's decision 2026-10-25): when a salon removes an artist from its
-- team, or an artist leaves one, the other side gets a card that stays until they tap «باشه», besides the push and
-- the SMS. `reason` is the salon's optional one line to the artist. Independent of other branches' migrations.
CREATE TABLE IF NOT EXISTS team_notices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  from_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  from_name TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  seen_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_team_notices_unseen ON team_notices(user_id) WHERE seen_at IS NULL;

-- Down Migration
DROP TABLE IF EXISTS team_notices;
