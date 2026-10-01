-- Up Migration
--
-- Converts the INTEGER-0/1 "boolean" columns (a SQLite-era convention
-- carried into Postgres verbatim in 001_baseline.sql) to native BOOLEAN.
--
-- Single-step ALTER COLUMN TYPE, not a shadow-column/backfill/swap dance:
-- this app has one deployment unit (migrations run once at deploy time,
-- immediately followed by the matching code), so there's no window where
-- old and new code run concurrently against a half-migrated column.
-- It's also safe even without perfect lockstep -- Postgres accepts the
-- text '0'/'1' as valid boolean input on write, and the `pg` driver
-- already returns real JS true/false for a boolean column, which every
-- read site in this codebase already handles via Boolean(row.col)/
-- truthy checks (verified: no `=== 1`/`=== 0` comparison exists on any
-- of these columns anywhere in app/).
--
-- DROP DEFAULT before the type change and SET DEFAULT after: integer ->
-- boolean has no implicit/assignment cast, so the stored default
-- expression needs to be re-specified as a boolean literal rather than
-- relying on ALTER TYPE to convert it.

ALTER TABLE posts ALTER COLUMN in_explore DROP DEFAULT;
ALTER TABLE posts ALTER COLUMN in_explore TYPE boolean USING (in_explore <> 0);
ALTER TABLE posts ALTER COLUMN in_explore SET DEFAULT true;

ALTER TABLE posts ALTER COLUMN featured DROP DEFAULT;
ALTER TABLE posts ALTER COLUMN featured TYPE boolean USING (featured <> 0);
ALTER TABLE posts ALTER COLUMN featured SET DEFAULT false;

ALTER TABLE artist_hours ALTER COLUMN active DROP DEFAULT;
ALTER TABLE artist_hours ALTER COLUMN active TYPE boolean USING (active <> 0);
ALTER TABLE artist_hours ALTER COLUMN active SET DEFAULT true;

ALTER TABLE salon_hours ALTER COLUMN active DROP DEFAULT;
ALTER TABLE salon_hours ALTER COLUMN active TYPE boolean USING (active <> 0);
ALTER TABLE salon_hours ALTER COLUMN active SET DEFAULT true;

ALTER TABLE beauty_passports ALTER COLUMN active DROP DEFAULT;
ALTER TABLE beauty_passports ALTER COLUMN active TYPE boolean USING (active <> 0);
ALTER TABLE beauty_passports ALTER COLUMN active SET DEFAULT false;

-- Down Migration

ALTER TABLE beauty_passports ALTER COLUMN active DROP DEFAULT;
ALTER TABLE beauty_passports ALTER COLUMN active TYPE integer USING (CASE WHEN active THEN 1 ELSE 0 END);
ALTER TABLE beauty_passports ALTER COLUMN active SET DEFAULT 0;

ALTER TABLE salon_hours ALTER COLUMN active DROP DEFAULT;
ALTER TABLE salon_hours ALTER COLUMN active TYPE integer USING (CASE WHEN active THEN 1 ELSE 0 END);
ALTER TABLE salon_hours ALTER COLUMN active SET DEFAULT 1;

ALTER TABLE artist_hours ALTER COLUMN active DROP DEFAULT;
ALTER TABLE artist_hours ALTER COLUMN active TYPE integer USING (CASE WHEN active THEN 1 ELSE 0 END);
ALTER TABLE artist_hours ALTER COLUMN active SET DEFAULT 1;

ALTER TABLE posts ALTER COLUMN featured DROP DEFAULT;
ALTER TABLE posts ALTER COLUMN featured TYPE integer USING (CASE WHEN featured THEN 1 ELSE 0 END);
ALTER TABLE posts ALTER COLUMN featured SET DEFAULT 0;

ALTER TABLE posts ALTER COLUMN in_explore DROP DEFAULT;
ALTER TABLE posts ALTER COLUMN in_explore TYPE integer USING (CASE WHEN in_explore THEN 1 ELSE 0 END);
ALTER TABLE posts ALTER COLUMN in_explore SET DEFAULT 1;
