-- Up Migration
--
-- Indexes for the filters the app hits on every dashboard load / poll
-- (owner-scoped lists were sequential scans once tables grow).
CREATE INDEX IF NOT EXISTS idx_artist_bookings_artist_date ON artist_bookings (artist_user_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_salon_staff_salon ON salon_staff (salon_user_id);
CREATE INDEX IF NOT EXISTS idx_salon_staff_artist ON salon_staff (artist_user_id);
CREATE INDEX IF NOT EXISTS idx_salon_services_salon ON salon_services (salon_user_id);
CREATE INDEX IF NOT EXISTS idx_salon_portfolio_salon ON salon_portfolio (salon_user_id);
CREATE INDEX IF NOT EXISTS idx_artist_collabs_salon ON artist_collabs (salon_user_id);
CREATE INDEX IF NOT EXISTS idx_post_saves_post ON post_saves (post_id);
CREATE INDEX IF NOT EXISTS idx_posts_explore_featured ON posts (in_explore, featured DESC, id DESC);

-- Down Migration
DROP INDEX IF EXISTS idx_posts_explore_featured;
DROP INDEX IF EXISTS idx_post_saves_post;
DROP INDEX IF EXISTS idx_artist_collabs_salon;
DROP INDEX IF EXISTS idx_salon_portfolio_salon;
DROP INDEX IF EXISTS idx_salon_services_salon;
DROP INDEX IF EXISTS idx_salon_staff_artist;
DROP INDEX IF EXISTS idx_salon_staff_salon;
DROP INDEX IF EXISTS idx_artist_bookings_artist_date;
