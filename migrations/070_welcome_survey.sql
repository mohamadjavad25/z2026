-- Up Migration
-- The welcome survey (owner, 2026-11-05): one short survey for a person who has really started, with their own name
-- and numbers on it. One row per person, made the first time they answer, put it off, or get its push.
-- parts holds ids from a fixed list (app/shared/lib/welcomeSurvey.js); idea is their own words.
CREATE TABLE IF NOT EXISTS welcome_surveys (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  feel SMALLINT,
  parts TEXT[] NOT NULL DEFAULT '{}',
  idea TEXT NOT NULL DEFAULT '',
  answered_at TIMESTAMPTZ,
  later_count SMALLINT NOT NULL DEFAULT 0,
  next_at TIMESTAMPTZ,
  pushed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS welcome_surveys_answered ON welcome_surveys (answered_at DESC) WHERE answered_at IS NOT NULL;

-- Down Migration
DROP TABLE IF EXISTS welcome_surveys;
