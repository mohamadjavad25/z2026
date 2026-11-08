-- One team row per salon and artist (HEALTH debt 10, 2026-11-08).
--
-- Every way into a team (the salon's invite, the salon's link or QR, the artist's proposal) already takes the same
-- pair lock and reuses the pair's row when there is one. This index is the last line behind that: if some future path
-- forgets the lock, the database refuses a second row instead of quietly keeping two.
--
-- The manager's own row and hand-added members have no artist account (artist_user_id IS NULL) and are not covered.
-- If old data already holds a duplicate pair, the index is not created and the migration still succeeds (with a
-- NOTICE); a later migration adds it once those pairs are merged by hand. Migrations run once, so check after deploy:
--   SELECT indexname FROM pg_indexes WHERE indexname = 'salon_staff_one_seat';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'salon_staff_one_seat') THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM salon_staff
    WHERE artist_user_id IS NOT NULL
    GROUP BY salon_user_id, artist_user_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'salon_staff_one_seat skipped: duplicate salon/artist rows exist';
    RETURN;
  END IF;
  EXECUTE 'CREATE UNIQUE INDEX salon_staff_one_seat ON salon_staff (salon_user_id, artist_user_id) WHERE artist_user_id IS NOT NULL';
END
$$;
