-- Up Migration
-- The profile «درباره» (about) text was removed from the product for salons and artists,
-- so the column that held it is dropped. (salon_staff.bio / salon_invites.bio are different:
-- they carry the collaboration terms of an invite and stay.)
ALTER TABLE users DROP COLUMN IF EXISTS bio;

-- Down Migration
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
