-- Up Migration
-- A photo picked from the phone's gallery for one service (sample photos on services, 2026-11-06) is stored as a post
-- that is NOT part of the owner's portfolio: it uses the same picture pipeline (thumbnail, storage, media route) but is
-- never listed in «نمونه‌کار», counted as a work, or shown in a gallery. Own column only.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS in_portfolio BOOLEAN NOT NULL DEFAULT TRUE;

-- Down Migration
ALTER TABLE posts DROP COLUMN IF EXISTS in_portfolio;
