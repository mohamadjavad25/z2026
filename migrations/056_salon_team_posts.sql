-- Up Migration
-- A team artist's post goes on the salon's page only once the salon approves it (owner's decision 2026-10-26). The
-- artist sends a post to a salon whose team they are on; the salon sees it under «درخواست‌های تیم» and adds it or not.
-- The row hangs on the membership (staff_id): when the artist leaves or is removed, their posts leave the salon's page
-- with them and a later return starts from nothing. A deleted post takes its rows with it.
CREATE TABLE IF NOT EXISTS salon_team_posts (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL REFERENCES salon_staff(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  PRIMARY KEY (post_id, salon_user_id)
);
CREATE INDEX IF NOT EXISTS idx_salon_team_posts_salon ON salon_team_posts (salon_user_id, status);
CREATE INDEX IF NOT EXISTS idx_salon_team_posts_staff ON salon_team_posts (staff_id);
-- An earlier draft of this feature (an on-by-default switch, never on the main server) left this column on the test copy.
ALTER TABLE salon_staff DROP COLUMN IF EXISTS posts_on_salon;

-- Down Migration
DROP TABLE IF EXISTS salon_team_posts;
