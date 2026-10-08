-- Up Migration
-- Artists are linked to services automatically from their skills (app/shared/lib/serviceSkills.js).
-- salon_services.staff_ids now holds only the artists the salon added by hand, and this column the
-- ones it removed by hand from the automatic match. (Also added on first use by the services repo.)
ALTER TABLE salon_services ADD COLUMN IF NOT EXISTS staff_excluded_ids TEXT NOT NULL DEFAULT '';

-- Down Migration
ALTER TABLE salon_services DROP COLUMN IF EXISTS staff_excluded_ids;
