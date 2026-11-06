import { getDb, all, get, run, withTransaction } from "../connection.js";

/** A service shows at most this many sample photos (owner's recommendation, 2026-11-06). */
export const MAX_SERVICE_PHOTOS = 3;

const COLUMN = { artist: "artist_service_id", salon: "salon_service_id" };
const SERVICE_TABLE = { artist: ["artist_services", "user_id"], salon: ["salon_services", "salon_user_id"] };

function photoUrl(row) {
  return `/api/media/post/${row.post_id}?v=${row.updated_at ? new Date(row.updated_at).getTime() : 0}`;
}

/**
 * Adds `photos` ([{ postId, image, title }], cover first) to each service row: the owner's public portfolio posts
 * linked to it. A private post is never listed, because its picture is served to its owner only.
 * `kind` is "artist" or "salon". Services without a link get an empty list.
 */
export async function withServicePhotos(kind, services, runner = null) {
  const list = Array.isArray(services) ? services : [];
  const ids = list.map((service) => Number(service.id)).filter(Boolean);
  if (!ids.length) return list.map((service) => ({ ...service, photos: [] }));
  const db = runner || (await getDb());
  const column = COLUMN[kind];
  const rows = await all(db, `
    SELECT sp.${column} AS service_id, sp.post_id, p.title, p.updated_at
    FROM service_photos sp
    JOIN posts p ON p.id = sp.post_id
    WHERE sp.${column} = ANY($1::int[]) AND p.is_public AND (p.image <> '' OR p.image_url IS NOT NULL)
    ORDER BY sp.position, sp.id
  `, [ids]);
  const byService = new Map();
  for (const row of rows) {
    if (!byService.has(row.service_id)) byService.set(row.service_id, []);
    byService.get(row.service_id).push({ postId: row.post_id, image: photoUrl(row), title: row.title || "" });
  }
  return list.map((service) => ({ ...service, photos: byService.get(Number(service.id)) || [] }));
}

/**
 * Replaces a service's photos with `postIds` (in order, the first is the cover). Only the owner's own public posts
 * count, duplicates are dropped, and at most MAX_SERVICE_PHOTOS are kept.
 * Returns the saved list of post ids, or null when the service is not the owner's.
 */
export async function setServicePhotos(kind, ownerId, serviceId, postIds) {
  const [table, ownerColumn] = SERVICE_TABLE[kind] || [];
  if (!table) return null;
  const wanted = [...new Set((Array.isArray(postIds) ? postIds : []).map(Number).filter((id) => Number.isInteger(id) && id > 0))]
    .slice(0, MAX_SERVICE_PHOTOS);
  return withTransaction(null, async (db) => {
    const service = await get(db, `SELECT id FROM ${table} WHERE id = $1 AND ${ownerColumn} = $2 FOR UPDATE`, [serviceId, ownerId]);
    if (!service) return null;
    const own = wanted.length
      ? await all(db, "SELECT id FROM posts WHERE owner_user_id = $1 AND is_public AND id = ANY($2::int[])", [ownerId, wanted])
      : [];
    const ownIds = new Set(own.map((row) => Number(row.id)));
    const kept = wanted.filter((id) => ownIds.has(id));
    const column = COLUMN[kind];
    await run(db, `DELETE FROM service_photos WHERE ${column} = $1`, [serviceId]);
    for (let position = 0; position < kept.length; position += 1) {
      await run(db, `INSERT INTO service_photos (${column}, post_id, position) VALUES ($1, $2, $3)`, [serviceId, kept[position], position]);
    }
    return kept;
  });
}
