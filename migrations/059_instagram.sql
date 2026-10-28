-- Up Migration
-- A salon's or artist's Instagram page (owner's decision 2026-10-27): only the page name, lower case, no "@"
-- (app/shared/lib/instagram.js). "" means none; the Instagram folder on the public page shows only when set.
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram TEXT NOT NULL DEFAULT '';

-- Down Migration
ALTER TABLE users DROP COLUMN IF EXISTS instagram;
