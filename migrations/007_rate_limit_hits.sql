-- Up Migration
--
-- Backs the rewritten app/lib/rateLimit.js: replaces the in-memory Map
-- sliding-window limiter (broken on the app's actual Vercel serverless
-- deployment target -- each serverless instance has its own independent
-- Map, so a rate limit resets on every cold start and is trivially
-- bypassed by hitting different instances; the old code's own comment
-- claiming "this app has no multi-instance/serverless deployment" was
-- simply wrong for where this app actually runs) with a real DB-backed
-- counter every instance shares.

CREATE TABLE IF NOT EXISTS rate_limit_hits (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL,
  hit_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_key_time ON rate_limit_hits(key, hit_at);

-- Down Migration

DROP TABLE IF EXISTS rate_limit_hits;
