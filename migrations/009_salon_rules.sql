-- Up Migration
--
-- Free-text salon rules & terms (cancellation policy, lateness, ...), written
-- by the salon owner and shown on the public salon page. Ported from a
-- change made directly against the old request-time schema-bootstrap
-- script (app/lib/db/schema.js, removed when this project moved to
-- node-pg-migrate) on a parallel branch -- this migration captures the
-- same column addition so it's tracked like every other schema change.

ALTER TABLE salons ADD COLUMN IF NOT EXISTS rules TEXT NOT NULL DEFAULT '';

-- Down Migration

ALTER TABLE salons DROP COLUMN IF EXISTS rules;
