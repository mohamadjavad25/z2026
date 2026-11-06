-- Up Migration
-- The come-back nudge (owner, 2026-11-06) must know how long someone was away BEFORE this visit. last_seen_at is
-- refreshed by the first footprint send (1.5 s after the page opens), earlier than the nudge asks, so the gap was lost.
-- prev_seen_at keeps the end of the previous visit: it is set when a new visit starts (last_seen_at older than 30 min).
-- Own column, empty for everyone until their next visit.
ALTER TABLE users ADD COLUMN IF NOT EXISTS prev_seen_at TIMESTAMPTZ;

-- Down Migration
ALTER TABLE users DROP COLUMN IF EXISTS prev_seen_at;
