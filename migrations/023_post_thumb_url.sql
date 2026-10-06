-- Up Migration
--
-- Storage copy of a post's small grid picture (the full picture's copy is posts.image_url,
-- migration 008). Once both are in Supabase Storage the base64 columns are emptied and the
-- database stops carrying (and serving) the image bytes. app/lib/db/mediaSchema.js applies the
-- same statement at runtime, so either path leaves the column in place.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS thumb_url TEXT;

-- Down Migration

ALTER TABLE posts DROP COLUMN IF EXISTS thumb_url;
