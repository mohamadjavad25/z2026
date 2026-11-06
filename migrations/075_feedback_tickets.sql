-- Up Migration
-- «نظر و پیشنهاد» in support (owner 2026-11-06): a support ticket can carry the part of frfro it is about, what kind of
-- note it is, and optional stars. Same DDL as ensureSupportTables; own columns only, so it is safe beside other branches.
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS feedback_section TEXT NOT NULL DEFAULT '';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS feedback_kind TEXT NOT NULL DEFAULT '';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS feedback_stars SMALLINT;

-- Down Migration
ALTER TABLE support_tickets DROP COLUMN IF EXISTS feedback_stars;
ALTER TABLE support_tickets DROP COLUMN IF EXISTS feedback_kind;
ALTER TABLE support_tickets DROP COLUMN IF EXISTS feedback_section;
