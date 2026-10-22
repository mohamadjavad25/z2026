-- Up Migration
--
-- One phone normaliser for bookings (owner's decision 2026-10-22). Until now phone_normalized only mapped the
-- Persian digits, so a number typed with Arabic-Indic digits (٠٩١٢...) or with spaces/dashes never matched the
-- account that owns it. frfro_phone_key() does what app/shared/lib/phone.js does: Persian, Arabic-Indic and
-- full-width digits to Latin, and separators (space, dash, dot, brackets, direction marks) dropped.
--
-- The column is GENERATED, so dropping and adding it again rebuilds every old row with the new rule (the
-- backfill), and the index follows. Independent of other branches: it only touches this column and function.

CREATE OR REPLACE FUNCTION frfro_phone_key(value TEXT) RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT regexp_replace(
    translate(COALESCE(value, ''),
      '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩０１２３４５６７８９',
      '012345678901234567890123456789'),
    '[[:space:]\-(). ‌‍‎‏]', '', 'g')
$$;

DROP INDEX IF EXISTS idx_salon_bookings_phone_normalized;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS phone_normalized;
ALTER TABLE salon_bookings ADD COLUMN phone_normalized TEXT GENERATED ALWAYS AS (frfro_phone_key(phone)) STORED;
CREATE INDEX IF NOT EXISTS idx_salon_bookings_phone_normalized ON salon_bookings(phone_normalized);

DROP INDEX IF EXISTS idx_artist_bookings_phone_normalized;
ALTER TABLE artist_bookings DROP COLUMN IF EXISTS phone_normalized;
ALTER TABLE artist_bookings ADD COLUMN phone_normalized TEXT GENERATED ALWAYS AS (frfro_phone_key(client_phone)) STORED;
CREATE INDEX IF NOT EXISTS idx_artist_bookings_phone_normalized ON artist_bookings(phone_normalized);

-- Down Migration

DROP INDEX IF EXISTS idx_artist_bookings_phone_normalized;
ALTER TABLE artist_bookings DROP COLUMN IF EXISTS phone_normalized;
ALTER TABLE artist_bookings ADD COLUMN phone_normalized TEXT
  GENERATED ALWAYS AS (
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(client_phone,
      '۰','0'),'۱','1'),'۲','2'),'۳','3'),'۴','4'),'۵','5'),'۶','6'),'۷','7'),'۸','8'),'۹','9')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_artist_bookings_phone_normalized ON artist_bookings(phone_normalized);

DROP INDEX IF EXISTS idx_salon_bookings_phone_normalized;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS phone_normalized;
ALTER TABLE salon_bookings ADD COLUMN phone_normalized TEXT
  GENERATED ALWAYS AS (
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,
      '۰','0'),'۱','1'),'۲','2'),'۳','3'),'۴','4'),'۵','5'),'۶','6'),'۷','7'),'۸','8'),'۹','9')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_salon_bookings_phone_normalized ON salon_bookings(phone_normalized);
