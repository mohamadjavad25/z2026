import { getDb, all, get, run } from "../../connection.js";

const defaultArtistHours = [
  { day: "شنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: true },
  { day: "یکشنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: true },
  { day: "دوشنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: true },
  { day: "سه‌شنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: true },
  { day: "چهارشنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: true },
  { day: "پنجشنبه", open_time: "۱۰:۰۰", close_time: "۱۸:۰۰", capacity: 5, active: true },
  { day: "جمعه", open_time: "", close_time: "", capacity: 0, active: false }
];

export async function ensureArtistHours(artistUserId, runner = null) {
  const db = runner || (await getDb());
  const has = await get(db, "SELECT id FROM artist_hours WHERE artist_user_id = $1 LIMIT 1", [artistUserId]);
  if (has) return;
  for (const h of defaultArtistHours) {
    await run(db, `
      INSERT INTO artist_hours (artist_user_id, day, open_time, close_time, capacity, active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (artist_user_id, day) DO NOTHING
    `, [artistUserId, h.day, h.open_time, h.close_time, h.capacity, h.active]);
  }
}

export async function listArtistHours(artistUserId, runner = null) {
  const db = runner || (await getDb());
  await ensureArtistHours(artistUserId, db);
  const order = new Map(defaultArtistHours.map((h, i) => [h.day, i]));
  const rows = await all(db, "SELECT * FROM artist_hours WHERE artist_user_id = $1", [artistUserId]);
  return rows.sort((a, b) => (order.get(a.day) ?? 99) - (order.get(b.day) ?? 99));
}

export async function updateArtistHour(artistUserId, day, data) {
  const db = await getDb();
  await ensureArtistHours(artistUserId, db);
  await run(db, `
    UPDATE artist_hours SET
      open_time = COALESCE($1, open_time),
      close_time = COALESCE($2, close_time),
      capacity = COALESCE($3, capacity),
      active = COALESCE($4, active),
      updated_at = CURRENT_TIMESTAMP
    WHERE artist_user_id = $5 AND day = $6
  `, [
    data.openTime ?? data.open_time ?? null,
    data.closeTime ?? data.close_time ?? null,
    data.capacity ?? null,
    data.active === undefined ? null : Boolean(data.active),
    artistUserId,
    day
  ]);
  return get(db, "SELECT * FROM artist_hours WHERE artist_user_id = $1 AND day = $2", [artistUserId, day]);
}

/** Public, read-only view: never creates the default rows (a visit must not write). */
export async function listArtistHoursPublic(artistUserId, runner = null) {
  const db = runner || (await getDb());
  const order = new Map(defaultArtistHours.map((h, i) => [h.day, i]));
  const rows = await all(db, "SELECT day, open_time, close_time, active FROM artist_hours WHERE artist_user_id = $1", [artistUserId]);
  return rows.sort((a, b) => (order.get(a.day) ?? 99) - (order.get(b.day) ?? 99));
}
