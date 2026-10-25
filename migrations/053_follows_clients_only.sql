-- Up Migration
-- Only clients connect («وصل شو») to a salon or artist (owner's decision 2026-10-25). Salons and artists that got
-- connected to each other by mistake were listed among the other's customers: those rows go. Nothing else is
-- touched: teams, invites, proposals and bookings stay as they are.
DELETE FROM follows f
USING users u
WHERE u.id = f.follower_user_id AND u.type <> 'client';
UPDATE salons s SET follower_count = (SELECT COUNT(*) FROM follows f WHERE f.target_user_id = s.user_id);

-- Down Migration
-- The removed rows are not brought back.
