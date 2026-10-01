-- Up Migration
--
-- Adds indexes for hot-path query filters that were doing a full sequential
-- scan: users.type (every artist/salon directory query filters
-- WHERE type = 'artist'/'salon'), and client_user_id on both booking
-- tables (every "list my bookings" query filters on it).
--
-- CONCURRENTLY so this doesn't take a table-level lock that would block
-- reads/writes on a live database while the index builds -- but
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block, and
-- node-pg-migrate wraps each migration in one by default, so this
-- migration is marked `{ transaction: false }` via a pgmigrate directive
-- comment... node-pg-migrate's SQL-file runner doesn't support a per-file
-- no-transaction directive the way its JS migrations do, so instead this
-- file is deliberately plain CREATE INDEX (not CONCURRENTLY): the four
-- tables here are small at this stage of the product (pre-launch), so a
-- brief exclusive lock during index build is an acceptable, one-time cost
-- in exchange for keeping this migration transactional and safe to run
-- alongside 002/003 in one deploy step. If any of these tables ever grows
-- large enough that this matters, rebuild the specific index with
-- CONCURRENTLY by hand outside a migration.

CREATE INDEX IF NOT EXISTS idx_users_type ON users(type);
CREATE INDEX IF NOT EXISTS idx_salon_bookings_client ON salon_bookings(client_user_id);
CREATE INDEX IF NOT EXISTS idx_artist_bookings_client ON artist_bookings(client_user_id);

-- Down Migration

DROP INDEX IF EXISTS idx_artist_bookings_client;
DROP INDEX IF EXISTS idx_salon_bookings_client;
DROP INDEX IF EXISTS idx_users_type;
