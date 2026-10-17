-- Up Migration
-- A follow is a contact: the salon or artist sees who followed (name + phone from the follower's own account) in
-- their customers page. seen_at is when the owner opened that page after the follow; NULL means "new". Rows that
-- already exist are marked seen so nobody is flooded with old followers the day this ships.
ALTER TABLE follows ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ;
UPDATE follows SET seen_at = CURRENT_TIMESTAMP WHERE seen_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_follows_target_recent ON follows (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_target_unseen ON follows (target_user_id) WHERE seen_at IS NULL;

-- Down Migration
DROP INDEX IF EXISTS idx_follows_target_unseen;
DROP INDEX IF EXISTS idx_follows_target_recent;
ALTER TABLE follows DROP COLUMN IF EXISTS seen_at;
