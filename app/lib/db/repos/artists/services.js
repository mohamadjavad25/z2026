/** An artist's own services (the menu on their page). */
import { getDb, withTransaction, all, get, run } from "../../connection.js";
import { normalizeServiceEmoji } from "../serviceEmoji.js";
import { withServicePhotos, applyServicePhotoChoice } from "../servicePhotos.js";
import { MAX_SERVICES_PER_PROVIDER } from "../../../validation/service.js";

export async function listArtistServices(userId, runner = null) {
  const db = runner || (await getDb());
  const rows = await all(db, `
    SELECT id, name, price, duration, hint, badge, tone, emoji, photo_as_cover
    FROM artist_services WHERE user_id = $1 ORDER BY id ASC
  `, [userId]);
  return withServicePhotos("artist", rows, db);
}

export async function addArtistService(userId, data) {
  const created = await insertArtistService(userId, data);
  if (!created?.id) return created;
  // The photo choice of the form (photoPostIds, photoAsCover), when it sent one.
  await applyServicePhotoChoice("artist", userId, created.id, data);
  return (await withServicePhotos("artist", [await get(await getDb(), "SELECT * FROM artist_services WHERE id = $1", [created.id])]))[0];
}

async function insertArtistService(userId, data) {
  // Counted and inserted under one lock per artist, so parallel requests can't slip past the cap.
  return withTransaction(null, async (db) => {
    await run(db, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`artist-services:${Number(userId)}`]);
    const count = await get(db, "SELECT COUNT(*)::int AS n FROM artist_services WHERE user_id = $1", [userId]);
    if (count.n >= MAX_SERVICES_PER_PROVIDER) return { limit: true };
    const info = await run(db, `
      INSERT INTO artist_services (user_id, name, price, duration, hint, badge, tone, emoji)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      userId,
      data.name || "",
      data.price || "",
      data.duration || "",
      data.hint || "",
      data.badge || "",
      data.tone || "soft",
      normalizeServiceEmoji(data.emoji)
    ]);
    return get(db, "SELECT * FROM artist_services WHERE id = $1", [Number(info.rows[0].id)]);
  });
}

export async function updateArtistService(id, userId, data) {
  const db = await getDb();
  const current = await get(db, "SELECT * FROM artist_services WHERE id = $1 AND user_id = $2", [id, userId]);
  if (!current) return null;
  await run(db, `
    UPDATE artist_services SET
      name = $1, price = $2, duration = $3, hint = $4, badge = $5, tone = $6, emoji = $7, updated_at = CURRENT_TIMESTAMP
    WHERE id = $8 AND user_id = $9
  `, [
    data.name ?? current.name,
    data.price ?? current.price,
    data.duration ?? current.duration,
    data.hint ?? current.hint,
    data.badge ?? current.badge,
    data.tone ?? current.tone,
    Object.prototype.hasOwnProperty.call(data, "emoji") ? normalizeServiceEmoji(data.emoji) : current.emoji,
    id,
    userId
  ]);
  await applyServicePhotoChoice("artist", userId, id, data);
  const updated = await get(db, "SELECT * FROM artist_services WHERE id = $1", [id]);
  return (await withServicePhotos("artist", [updated], db))[0];
}

export async function deleteArtistService(id, userId) {
  const db = await getDb();
  const result = await run(db, "DELETE FROM artist_services WHERE id = $1 AND user_id = $2", [id, userId]);
  return result.rowCount > 0;
}
