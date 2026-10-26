-- Up Migration
-- A team artist's posts also show on the salon's public page (owner's decision 2026-10-26). The artist can turn that off
-- for one salon with «پست‌هام توی صفحهٔ این سالن هم بیاد» on its card in «همکاری»; on by default. The row goes with the
-- membership, so posts leave the salon's page as soon as the artist leaves the team.
ALTER TABLE salon_staff ADD COLUMN IF NOT EXISTS posts_on_salon BOOLEAN NOT NULL DEFAULT TRUE;

-- Down Migration
ALTER TABLE salon_staff DROP COLUMN IF EXISTS posts_on_salon;
