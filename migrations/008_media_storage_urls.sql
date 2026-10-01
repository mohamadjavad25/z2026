-- Up Migration
--
-- Add-only step 1 of the staged Supabase Storage migration for images
-- (see docs/DEVLOG.md and app/lib/storage.js): avatar/poster/post images
-- are currently base64 text inside users.avatar/users.poster/posts.image,
-- which bloats row size and defeats CDN caching. These new nullable
-- columns hold the Supabase Storage public URL once an image is
-- dual-written there (app/lib/db/repos/users.js's updateUser/createUser,
-- app/lib/db/repos/posts.js's createPost/updatePost) -- the base64
-- columns and the existing /api/media/* streaming routes stay fully
-- active; nothing reads these new columns yet. Cutover (switching reads
-- to these URLs and dropping the base64 columns) is a separate, later
-- migration, deliberately not done here -- see the note in DEVLOG on why
-- this sandbox can't verify a real Storage upload/download round-trip.
--
-- salon_portfolio.image/.tile are NOT touched: that table is legacy-only
-- (new portfolio entries write through posts, see
-- app/lib/db/repos/salons/portfolio.js), so adding a Storage path for a
-- dead write path would be wasted complexity.

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS poster_url TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Down Migration

ALTER TABLE posts DROP COLUMN IF EXISTS image_url;
ALTER TABLE users DROP COLUMN IF EXISTS poster_url;
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
