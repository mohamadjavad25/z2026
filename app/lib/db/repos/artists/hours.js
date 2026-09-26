import { getDb, all, get, run } from "../../connection.js";

const defaultArtistHours = [
  { day: "شنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: 1 },
  { day: "یکشنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: 1 },
  { day: "دوشنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: 1 },
  { day: "سه‌شنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: 1 },
  { day: "چهارشنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: 1 },
  { day: "پنجشنبه", open_time: "۱۰:۰۰", close_time: "۱۸:۰۰", capacity: 5, active: 1 },
  { day: "جمعه", open_time: "", close_time: "", capacity: 0, active: 0 }
];

export async function ensureArtistHours(artistUserId, runner = null) {
  const db = runner || (await getDb());
  const has = await get(db, "SELECT id FROM artist_hours WHERE artist_user_id = ? LIMIT 1", [artistUserId]);
  if (has) return;
  for (const h of defaultArtistHours) {
    await run(db, `
      INSERT INTO artist_hours (artist_user_id, day, open_time, close_time, capacity, active)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (artist_user_id, day) DO NOTHING
    `, [artistUserId, h.day, h.open_time, h.close_time, h.capacity, h.active]);
  }
}

export async function listArtistHours(artistUserId, runner = null) {
  const db = runner || (await getDb());
  await ensureArtistHours(artistUserId, db);
  const order = new Map(defaultArtistHours.map((h, i) => [h.day, i]));
  const rows = await all(db, "SELECT * FROM artist_hours WHERE artist_user_id = ?", [artistUserId]);
  return rows.sort((a, b) => (order.get(a.day) ?? 99) - (order.get(b.day) ?? 99));
}

export async function updateArtistHour(artistUserId, day, data) {
  const db = await getDb();
  await ensureArtistHours(artistUserId, db);
  await run(db, `
    UPDATE artist_hours SET
      open_time = COALESCE(?, open_time),
      close_time = COALESCE(?, close_time),
      capacity = COALESCE(?, capacity),
      active = COALESCE(?, active),
      updated_at = CURRENT_TIMESTAMP
    WHERE artist_user_id = ? AND day = ?
  `, [
    data.openTime ?? data.open_time ?? null,
    data.closeTime ?? data.close_time ?? null,
    data.capacity ?? null,
    data.active === undefined ? null : (data.active ? 1 : 0),
    artistUserId,
    day
  ]);
  return get(db, "SELECT * FROM artist_hours WHERE artist_user_id = ? AND day = ?", [artistUserId, day]);
}
