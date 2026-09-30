-- Up Migration
--
-- user_settings.settings was an untyped TEXT column holding a JSON blob,
-- manually JSON.parse/JSON.stringify'd in app/lib/db/repos/userSettings.js.
-- Converts it to native JSONB -- Postgres validates the shape on write and
-- the `pg` driver auto-parses it back into a JS object on read (matching
-- code change removes the now-redundant manual JSON.parse/JSON.stringify
-- on the read side).

ALTER TABLE user_settings ALTER COLUMN settings DROP DEFAULT;
ALTER TABLE user_settings ALTER COLUMN settings TYPE JSONB USING settings::jsonb;
ALTER TABLE user_settings ALTER COLUMN settings SET DEFAULT '{}'::jsonb;

-- Down Migration

ALTER TABLE user_settings ALTER COLUMN settings DROP DEFAULT;
ALTER TABLE user_settings ALTER COLUMN settings TYPE TEXT USING settings::text;
ALTER TABLE user_settings ALTER COLUMN settings SET DEFAULT '{}';
