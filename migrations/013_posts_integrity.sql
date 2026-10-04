-- Up Migration
--
-- Posts hardening:
--  * `featured` was hard-coded to true by every client save, so it carried no
--    meaning. It now means "pinned by the owner" (capped per owner in the API);
--    reset the meaningless values.
--  * Legacy salon_portfolio rows are folded into posts (public), so there is one
--    source of truth and no more "title::image" de-duplication on read.
--  * post_views records at most one view per viewer per day, replacing a bare
--    counter anyone could inflate with a curl loop.
--  * Owner-gallery ordering index.

UPDATE posts SET featured = FALSE;

INSERT INTO posts (owner_user_id, title, tag, image, caption, in_explore, featured, created_at, updated_at)
SELECT sp.salon_user_id, sp.title, sp.tag, sp.image, '', TRUE, FALSE, sp.created_at, sp.created_at
FROM salon_portfolio sp
WHERE sp.image <> '';
DELETE FROM salon_portfolio;

CREATE TABLE IF NOT EXISTS post_views (
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  viewer_key TEXT    NOT NULL,
  day        DATE    NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (post_id, viewer_key, day)
);

CREATE INDEX IF NOT EXISTS idx_posts_owner_order ON posts (owner_user_id, featured DESC, created_at DESC);
DROP INDEX IF EXISTS idx_posts_explore;

-- Down Migration
DROP INDEX IF EXISTS idx_posts_owner_order;
CREATE INDEX IF NOT EXISTS idx_posts_explore ON posts (in_explore, created_at);
DROP TABLE IF EXISTS post_views;
