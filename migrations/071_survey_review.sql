-- Up Migration
-- The admin marks a survey answer as seen and can keep a short note on it (owner, 2026-11-05).
-- Own columns only, on the table from 070; safe to run twice.
ALTER TABLE welcome_surveys ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ;
ALTER TABLE welcome_surveys ADD COLUMN IF NOT EXISTS admin_note TEXT NOT NULL DEFAULT '';

-- Down Migration
ALTER TABLE welcome_surveys DROP COLUMN IF EXISTS admin_note;
ALTER TABLE welcome_surveys DROP COLUMN IF EXISTS seen_at;
