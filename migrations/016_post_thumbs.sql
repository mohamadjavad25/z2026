-- Up Migration
-- A ready-made 480px WebP (base64) per post, so grids never resize a full picture on demand.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS thumb TEXT NOT NULL DEFAULT '';

-- Down Migration
ALTER TABLE posts DROP COLUMN IF EXISTS thumb;
