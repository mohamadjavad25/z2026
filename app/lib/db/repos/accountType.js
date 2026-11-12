import { getDb, all, get, run } from "../connection.js";
import { withBusinessNameLock, isBusinessNameTaken } from "./users.js";
import { planExit, closeOrphanBookings } from "./providerExit.js";
import { saveSettings } from "./userSettings.js";
import { salonGone } from "../../artistPlaceRelease.js";

/**
 * The admin's «تبدیل به آرتیست» (owner 2026-11-12, after an artist signed up as a salon by mistake). The account keeps
 * what is the same for both roles: phone, password, name, pictures, bio, place on the map, connected clients, its
 * نمونه‌کارها, subscription and payments. The salon's services and working hours are copied to the artist's own, with
 * each service's linked pictures. Everything that only a salon has (team, invites, owner card, join terms, team
 * money) is removed, and past salon bookings stay with the clients as history, the same as when a salon deletes itself.
 *
 * Refused, with nothing changed, when: the account is not a salon; another salon or artist holds the same name; a
 * booking is still ahead (waiting or confirmed); an artist with an account is on the team. The owner decides those
 * first. → { ok: true, services, hours } or { ok: false, code, message, count? }.
 */
export const CONVERT_REFUSALS = {
  not_salon: "این حساب سالن نیست.",
  name_taken: "یه سالن یا آرتیست دیگه همین اسم رو داره؛ اول اسم این حساب رو عوض کن.",
  live_bookings: "این سالن نوبت باز داره؛ اول اون نوبت‌ها باید تموم یا لغو بشن.",
  team: "توی تیم این سالن آرتیست هست؛ اول باید از تیم برن."
};

const refuse = (code, extra = {}) => ({ ok: false, code, message: CONVERT_REFUSALS[code], ...extra });

/** Artists with an account of their own on this salon's team (the salon's own «خودم هم کار می‌کنم» row is not one). */
async function teamArtists(salonUserId, runner) {
  return all(runner, `
    SELECT DISTINCT artist_user_id FROM salon_staff
    WHERE salon_user_id = $1 AND artist_user_id IS NOT NULL AND artist_user_id <> $1 AND NOT COALESCE(is_owner, false)
  `, [salonUserId]);
}

/** What the admin sees before confirming: whether it can be done, and what moves. */
export async function previewSalonToArtist(id) {
  const userId = Number(id);
  const db = await getDb();
  const user = await get(db, "SELECT id, type, name FROM users WHERE id = $1", [userId]);
  if (!user) return null;
  if (user.type !== "salon") return refuse("not_salon");
  if (await isBusinessNameTaken(user.name, userId)) return refuse("name_taken");
  const plan = await planExit({ scope: "account", user });
  if (plan.items.length) return refuse("live_bookings", { count: plan.items.length });
  if ((await teamArtists(userId, db)).length) return refuse("team");
  const counts = await get(db, `
    SELECT (SELECT COUNT(*)::int FROM salon_services WHERE salon_user_id = $1) AS services,
           (SELECT COUNT(*)::int FROM posts WHERE owner_user_id = $1) AS posts,
           (SELECT COUNT(*)::int FROM follows WHERE target_user_id = $1) AS clients
  `, [userId]);
  return { ok: true, ...counts };
}

export async function convertSalonToArtist(id) {
  const userId = Number(id);
  const before = await previewSalonToArtist(userId);
  if (!before || !before.ok) return before;

  const result = await withBusinessNameLock(async (client) => {
    // Checked again under the lock and the account's row lock: a rename, a new team member or a sign-up with the same
    // name in between must not slip through.
    const user = await get(client, "SELECT id, type, name FROM users WHERE id = $1 FOR UPDATE", [userId]);
    if (!user) return null;
    if (user.type !== "salon") return refuse("not_salon");
    if (await isBusinessNameTaken(user.name, userId, client)) return refuse("name_taken");
    if ((await teamArtists(userId, client)).length) return refuse("team");

    // Services, one by one so each one's pictures follow it.
    const services = await all(client, "SELECT * FROM salon_services WHERE salon_user_id = $1 ORDER BY id", [userId]);
    for (const service of services) {
      const made = await get(client, `
        INSERT INTO artist_services (user_id, name, price, duration, hint, emoji, photo_as_cover)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
      `, [userId, service.name, service.price || "", service.duration || "", service.hint || "", service.emoji || "", Boolean(service.photo_as_cover)]);
      await run(client, "UPDATE service_photos SET artist_service_id = $1, salon_service_id = NULL WHERE salon_service_id = $2", [made.id, service.id]);
    }

    // Working hours: the salon's week becomes the artist's week.
    const hours = await all(client, "SELECT * FROM salon_hours WHERE salon_user_id = $1", [userId]);
    await run(client, "DELETE FROM artist_hours WHERE artist_user_id = $1", [userId]);
    for (const hour of hours) {
      await run(client, `
        INSERT INTO artist_hours (artist_user_id, day, open_time, close_time, capacity, active)
        VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (artist_user_id, day) DO NOTHING
      `, [userId, hour.day, hour.open_time || "", hour.close_time || "", Number(hour.capacity) || 0, hour.active]);
    }

    // What only a salon has goes.
    for (const table of ["salon_services", "salon_hours", "salon_portfolio", "salon_staff", "salon_artist_invites", "salon_owner_profile",
      "salon_team_posts", "salon_join_terms", "team_terms", "team_term_proposals", "team_settlements", "team_ledger_lines",
      "artist_place_prefs", "artist_place_order"]) {
      await run(client, `DELETE FROM ${table} WHERE salon_user_id = $1`, [userId]);
    }
    await run(client, "DELETE FROM salons WHERE user_id = $1", [userId]);
    await run(client, "DELETE FROM booking_waitlist WHERE owner_kind = 'salon' AND owner_user_id = $1", [userId]);
    // Rows that pointed at the salon from elsewhere let go of it, as if the salon were deleted (ON DELETE SET NULL).
    await run(client, "UPDATE salon_bookings SET salon_user_id = NULL WHERE salon_user_id = $1", [userId]);
    await run(client, "UPDATE salon_bookings SET fallback_salon_user_id = NULL WHERE fallback_salon_user_id = $1", [userId]);
    await run(client, "UPDATE artist_bookings SET source_salon_user_id = NULL WHERE source_salon_user_id = $1", [userId]);
    await run(client, "UPDATE artist_collabs SET salon_user_id = NULL WHERE salon_user_id = $1", [userId]);
    await run(client, "UPDATE artist_workplace SET salon_user_id = NULL WHERE salon_user_id = $1", [userId]);

    await run(client, "UPDATE users SET type = 'artist', manager_name = '', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [userId]);
    // Signed out everywhere: an app left open would keep showing the salon's screens.
    await run(client, "DELETE FROM sessions WHERE user_id = $1", [userId]);
    return { ok: true, services: services.length, hours: hours.length, name: user.name };
  });

  if (result?.ok) {
    // A booking an artist held at this salon goes back to the artist's own place (none when there was no team).
    await salonGone({ salonUserId: userId, salonName: result.name || "" });
    await run(await getDb(), "UPDATE artist_bookings SET place_salon_user_id = NULL WHERE place_salon_user_id = $1 AND artist_user_id <> $1", [userId]);
    // A booking that reached the salon while this ran is closed with the usual notice to the client.
    await closeOrphanBookings();
    // The artist's own tutorial shows on the next sign-in.
    await saveSettings(userId, { tutorialPending: true }).catch(() => {});
  }
  return result;
}
