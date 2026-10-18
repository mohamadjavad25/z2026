-- Up Migration
-- Where a salon or artist is: the pin they set on the map in تنظیمات → ثبت لوکیشن (until now only the
-- address text in users.area was kept and the pin itself was thrown away), plus the part a map cannot
-- know (plate, floor, unit, bell). Clients see it on the public page and get directions from it.
-- NULL coordinates mean "no pin yet": the page then only shows the address text, as before.
ALTER TABLE users ADD COLUMN IF NOT EXISTS geo_lat DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS geo_lng DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_detail TEXT NOT NULL DEFAULT '';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_geo_pair;
ALTER TABLE users ADD CONSTRAINT users_geo_pair CHECK (
  (geo_lat IS NULL AND geo_lng IS NULL)
  OR (geo_lat BETWEEN -90 AND 90 AND geo_lng BETWEEN -180 AND 180)
);

-- Down Migration
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_geo_pair;
ALTER TABLE users DROP COLUMN IF EXISTS address_detail;
ALTER TABLE users DROP COLUMN IF EXISTS geo_lng;
ALTER TABLE users DROP COLUMN IF EXISTS geo_lat;
