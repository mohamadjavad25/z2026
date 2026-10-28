-- Up Migration
-- A team member's leave can have a return day (owner's decision 2026-10-28): the salon sets «مرخصیه» and, if it
-- wants, until when. The value is the first day back, as YYYY-MM-DD; '' means no end date. When the day comes the
-- member goes back to «فعال» (listSalonStaff). Nothing already booked moves.
ALTER TABLE salon_staff ADD COLUMN IF NOT EXISTS leave_until TEXT NOT NULL DEFAULT '';

-- Down Migration
ALTER TABLE salon_staff DROP COLUMN IF EXISTS leave_until;
