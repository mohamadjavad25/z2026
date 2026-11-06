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
  if (!ids.length) return list.map((service) => ({ ...service, photos: [], photoAsCover: true }));
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
  return list.map((service) => ({ ...service, photos: byService.get(Number(service.id)) || [], photoAsCover: service.photo_as_cover !== false }));
}

/**
 * Replaces a service's photos with `postIds` (in order, the first is the cover). Only the owner's own public posts
 * count, duplicates are dropped, and at most MAX_SERVICE_PHOTOS are kept.
 * `asCover` (true/false) also sets whether the photos replace the service icon in lists; left out it stays as it was.
 * Returns the saved list of post ids, or null when the service is not the owner's.
 */
export async function setServicePhotos(kind, ownerId, serviceId, postIds, { asCover } = {}) {
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
    if (typeof asCover === "boolean") await run(db, `UPDATE ${table} SET photo_as_cover = $1 WHERE id = $2`, [asCover, serviceId]);
    await run(db, `DELETE FROM service_photos WHERE ${column} = $1`, [serviceId]);
    for (let position = 0; position < kept.length; position += 1) {
      await run(db, `INSERT INTO service_photos (${column}, post_id, position) VALUES ($1, $2, $3)`, [serviceId, kept[position], position]);
    }
    return kept;
  });
}

/**
 * Replaces the services one of the owner's posts is linked to with `serviceIds` (the owner's own services of their
 * kind). A service that already has MAX_SERVICE_PHOTOS other photos is skipped. Returns the ids really linked.
 */
export async function setPostServices(ownerId, postId, serviceIds) {
  const wanted = [...new Set((Array.isArray(serviceIds) ? serviceIds : []).map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 100);
  return withTransaction(null, async (db) => {
    const post = await get(db, "SELECT p.id, u.type FROM posts p JOIN users u ON u.id = p.owner_user_id WHERE p.id = $1 AND p.owner_user_id = $2", [postId, ownerId]);
    const kind = post?.type === "salon" ? "salon" : post?.type === "artist" ? "artist" : null;
    if (!kind) return [];
    const [table, ownerColumn] = SERVICE_TABLE[kind];
    const column = COLUMN[kind];
    const own = wanted.length
      ? await all(db, `SELECT id FROM ${table} WHERE ${ownerColumn} = $1 AND id = ANY($2::int[]) ORDER BY id FOR UPDATE`, [ownerId, wanted])
      : [];
    const ownIds = new Set(own.map((row) => Number(row.id)));
    const desired = wanted.filter((id) => ownIds.has(id));
    // Only what changed: links to services no longer wanted go, missing ones are added at the end, the rest keep their
    // place, so editing a work never reshuffles a service's cover.
    const current = (await all(db, `SELECT ${column} AS service_id FROM service_photos WHERE post_id = $1 AND ${column} IS NOT NULL`, [postId])).map((row) => Number(row.service_id));
    const gone = current.filter((id) => !desired.includes(id));
    if (gone.length) await run(db, `DELETE FROM service_photos WHERE post_id = $1 AND ${column} = ANY($2::int[])`, [postId, gone]);
    const linked = desired.filter((id) => current.includes(id));
    for (const serviceId of desired.filter((id) => !current.includes(id))) {
      // A private work does not count: clients never see it (withServicePhotos).
      const count = await get(db, `SELECT COUNT(*)::int AS n FROM service_photos sp JOIN posts p ON p.id = sp.post_id AND p.is_public WHERE sp.${column} = $1`, [serviceId]);
      if (count.n >= MAX_SERVICE_PHOTOS) continue;
      const last = await get(db, `SELECT COALESCE(MAX(position) + 1, 0)::int AS n FROM service_photos WHERE ${column} = $1`, [serviceId]);
      await run(db, `INSERT INTO service_photos (${column}, post_id, position) VALUES ($1, $2, $3)`, [serviceId, postId, last.n]);
      linked.push(serviceId);
    }
    return linked;
  });
}

/**
 * What the owner's post composer needs: their services (id, name, how many photos each has, whether the photos
 * replace the icon) and which services each post is linked to ({ [postId]: [serviceId] }).
 */
export async function ownerServiceLinks(ownerId, type) {
  const kind = type === "salon" ? "salon" : type === "artist" ? "artist" : null;
  if (!kind) return { services: [], postServices: {} };
  const db = await getDb();
  const [table, ownerColumn] = SERVICE_TABLE[kind];
  const column = COLUMN[kind];
  const services = await all(db, `
    SELECT s.id, s.name, s.photo_as_cover, (SELECT COUNT(*)::int FROM service_photos sp JOIN posts p ON p.id = sp.post_id AND p.is_public WHERE sp.${column} = s.id) AS photo_count
    FROM ${table} s WHERE s.${ownerColumn} = $1 ORDER BY s.id
  `, [ownerId]);
  const links = await all(db, `
    SELECT sp.post_id, sp.${column} AS service_id FROM service_photos sp
    JOIN ${table} s ON s.id = sp.${column} WHERE s.${ownerColumn} = $1 ORDER BY sp.position, sp.id
  `, [ownerId]);
  const postServices = {};
  for (const row of links) (postServices[row.post_id] ||= []).push(row.service_id);
  return {
    services: services.map((row) => ({ id: row.id, name: row.name, photoCount: row.photo_count, photoAsCover: row.photo_as_cover !== false })),
    postServices
  };
}

/** Applies the photo choice a service form sends (`photoPostIds`, `photoAsCover`) after the service is saved. */
export async function applyServicePhotoChoice(kind, ownerId, serviceId, body) {
  const hasIds = Array.isArray(body?.photoPostIds);
  const hasMode = typeof body?.photoAsCover === "boolean";
  if (!hasIds && !hasMode) return;
  if (hasIds) {
    await setServicePhotos(kind, ownerId, serviceId, body.photoPostIds, hasMode ? { asCover: body.photoAsCover } : {});
    return;
  }
  const [table, ownerColumn] = SERVICE_TABLE[kind];
  const db = await getDb();
  await run(db, `UPDATE ${table} SET photo_as_cover = $1 WHERE id = $2 AND ${ownerColumn} = $3`, [body.photoAsCover, serviceId, ownerId]);
}
