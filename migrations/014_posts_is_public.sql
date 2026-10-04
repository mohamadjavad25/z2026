-- Up Migration
--
-- There is no explore feed any more: the flag only says whether the owner made a post
-- public (shown on their profile) or private (only they see it). Name it for what it is.
ALTER TABLE posts RENAME COLUMN in_explore TO is_public;
ALTER INDEX IF EXISTS idx_posts_explore_featured RENAME TO idx_posts_public_featured;

-- Down Migration
ALTER INDEX IF EXISTS idx_posts_public_featured RENAME TO idx_posts_explore_featured;
ALTER TABLE posts RENAME COLUMN is_public TO in_explore;
