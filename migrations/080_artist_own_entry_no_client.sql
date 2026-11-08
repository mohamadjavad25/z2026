-- An artist's own entry on their own page stored the artist's account as the booking's client
-- (the admin panel showed the artist as «مشتری» too; fixed in app/lib/artistBookingCreate.js, 2026-11-08).
-- An artist is never their own client: those rows lose the client account. Safe to run twice.
UPDATE artist_bookings SET client_user_id = NULL WHERE client_user_id IS NOT NULL AND client_user_id = artist_user_id;
