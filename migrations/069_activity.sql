-- Up Migration
-- The footprint (owner, 2026-11-05): who came, when, what they opened and did, when they left, so we can see where
-- the app needs work. One row per visit, one row per screen or action inside it. Nothing typed by the person is kept.
-- A visitor is a random id made on the phone; it joins an account when that phone signs in.
CREATE TABLE IF NOT EXISTS activity_visits (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  device TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  event_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS activity_visits_user ON activity_visits (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS activity_visits_started ON activity_visits (started_at DESC);
CREATE INDEX IF NOT EXISTS activity_visits_unclaimed ON activity_visits (visitor_id) WHERE user_id IS NULL;

CREATE TABLE IF NOT EXISTS activity_events (
  id BIGSERIAL PRIMARY KEY,
  visit_id TEXT NOT NULL REFERENCES activity_visits(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  profile_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS activity_events_visit ON activity_events (visit_id, created_at);
CREATE INDEX IF NOT EXISTS activity_events_profile ON activity_events (profile_user_id, created_at DESC) WHERE profile_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS activity_events_name ON activity_events (name, created_at DESC);

-- A deleted account leaves only numbers with no person behind them: the link goes (ON DELETE SET NULL above) and the
-- phone's id goes too, so a new account on the same phone cannot claim the old visits.
CREATE OR REPLACE FUNCTION activity_forget_user() RETURNS trigger AS $$
BEGIN
  UPDATE activity_visits SET visitor_id = 'gone' WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS activity_forget_user ON users;
CREATE TRIGGER activity_forget_user BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION activity_forget_user();

-- Down Migration
DROP TRIGGER IF EXISTS activity_forget_user ON users;
DROP FUNCTION IF EXISTS activity_forget_user();
DROP TABLE IF EXISTS activity_events;
DROP TABLE IF EXISTS activity_visits;
