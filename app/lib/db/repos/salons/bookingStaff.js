/**
 * The team member a salon booking belongs to: the one named on it, else the first who does its service. Apart from
 * ./staff.js because it needs the services too (services.js reads the team, so the team must not read the services).
 */
import { getDb, get, run } from "../../connection.js";
import { listSalonServices } from "./services.js";
import { artistAvatarUrl, resolveArtistUserForStaff } from "./staff.js";

export async function findSalonStaffForBooking(salonUserId, staffName, serviceName = "", runner = null) {
  const db = runner || (await getDb());
  const name = String(staffName || "").trim();
  const service = String(serviceName || "").trim();
  let row = name
    ? await get(db, `
      SELECT * FROM salon_staff
      WHERE salon_user_id = $1 AND name = $2
      LIMIT 1
    `, [salonUserId, name])
    : null;
  if (!row && service) {
    // No artist named: the first one who actually does this service (skill match + hand picks).
    const match = (await listSalonServices(salonUserId, db)).find((item) => String(item.name || "").trim() === service);
    const firstId = match?.staff_ids?.[0];
    row = firstId
      ? await get(db, "SELECT * FROM salon_staff WHERE id = $1 AND salon_user_id = $2", [Number(firstId), salonUserId]) || null
      : null;
  }
  if (!row && service) {
    row = await get(db, `
      SELECT *
      FROM salon_staff
      WHERE salon_user_id = $1
        AND artist_user_id IS NOT NULL
        AND (role = $2 OR bio LIKE $3)
      ORDER BY id DESC
      LIMIT 1
    `, [salonUserId, service, `%${service}%`]) || null;
  }
  if (!row) return null;
  const artist = await resolveArtistUserForStaff(row, db);
  if (artist?.id && !row.artist_user_id) {
    await run(db, `
      UPDATE salon_staff
      SET artist_user_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND salon_user_id = $3
    `, [artist.id, row.id, salonUserId]);
  }
  return {
    ...row,
    artist_user_id: artist?.id || row.artist_user_id || null,
    avatar: artistAvatarUrl(artist),
    staff_avatar: artistAvatarUrl(artist)
  };
}
