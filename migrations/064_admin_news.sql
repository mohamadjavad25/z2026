-- Up Migration
-- The operator's news in the «فرفرو مدیر» app (owner's decisions 2026-10-29, app/lib/adminNews.js): one row per kind of
-- news. The counts themselves are read from the real tables when a push goes out; this row only remembers when the
-- phone last rang for that kind (at most every 15 minutes), whether something new is still waiting to be told
-- (quiet hours, or inside the 15 minutes), the latest name to show, and, for the server watch, its own small state.
CREATE TABLE IF NOT EXISTS admin_news (
  kind TEXT PRIMARY KEY,
  pending BOOLEAN NOT NULL DEFAULT FALSE,
  last_label TEXT NOT NULL DEFAULT '',
  last_push_at TIMESTAMPTZ,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Down Migration
DROP TABLE IF EXISTS admin_news;
