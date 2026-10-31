-- Up Migration
-- «شرایط همکاری سالن» (owner's decision 2026-10-28): the salon saves ONE set of terms that its join link/QR shows, an artist
-- agrees to them by joining, or sends a counter-request. Times are the app's «۱۰:۰۰»; days are weekday names joined by «، ».

-- The salon's standing terms. `version` goes up on every save, so an artist who read version N and taps «بپیوند» after the
-- salon changed it gets TERMS_CHANGED instead of agreeing to numbers they never saw. No row = the link is not ready.
CREATE TABLE IF NOT EXISTS salon_join_terms (
  salon_user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  days TEXT NOT NULL DEFAULT '',
  from_time TEXT NOT NULL DEFAULT '',
  to_time TEXT NOT NULL DEFAULT '',
  share_percent INTEGER NOT NULL CHECK (share_percent BETWEEN 0 AND 100),
  own_share_percent INTEGER CHECK (own_share_percent BETWEEN 0 AND 100),
  allow_proposals BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- What an agreed row was agreed on: a copy of the salon's rules text of that day, and how they agreed ('join_page' / 'proposal').
ALTER TABLE team_terms ADD COLUMN IF NOT EXISTS rules_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE team_terms ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT '';

-- An artist's request from the join page: her own numbers (own_share_percent), a short note, the terms version she read, and
-- the day it lapses (7 days). Old rows keep NULLs.
ALTER TABLE artist_collabs ADD COLUMN IF NOT EXISTS own_share_percent INTEGER;
ALTER TABLE artist_collabs ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';
ALTER TABLE artist_collabs ADD COLUMN IF NOT EXISTS terms_version INTEGER;
ALTER TABLE artist_collabs ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Down Migration
ALTER TABLE artist_collabs DROP COLUMN IF EXISTS expires_at;
ALTER TABLE artist_collabs DROP COLUMN IF EXISTS terms_version;
ALTER TABLE artist_collabs DROP COLUMN IF EXISTS note;
ALTER TABLE artist_collabs DROP COLUMN IF EXISTS own_share_percent;
ALTER TABLE team_terms DROP COLUMN IF EXISTS source;
ALTER TABLE team_terms DROP COLUMN IF EXISTS rules_snapshot;
DROP TABLE IF EXISTS salon_join_terms;
