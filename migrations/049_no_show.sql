-- Up Migration
-- «نیومد» (owner's decision of 2026-10-25, roadmap ۱۴ stage 1): once a confirmed booking has started its salon or
-- artist can no longer cancel it; instead, until 24 hours after the start, they can mark that the client did not come.
-- The status stays confirmed (stored statuses never change); no_show_at says "did not come", NULL = came or unknown.
-- An artist's calendar copy of a salon booking carries the same mark.
ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ;
ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ;
-- When a «پیشنهاد ساعت دیگر» ran out unanswered and the original time stood (owner's decision of 2026-10-25: the client
-- gets a push and a line on the booking card, no SMS). A new proposal clears it.
ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS proposal_lapsed_at TIMESTAMPTZ;
ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS proposal_lapsed_at TIMESTAMPTZ;

-- Down Migration
ALTER TABLE artist_bookings DROP COLUMN IF EXISTS proposal_lapsed_at;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS proposal_lapsed_at;
ALTER TABLE artist_bookings DROP COLUMN IF EXISTS no_show_at;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS no_show_at;
