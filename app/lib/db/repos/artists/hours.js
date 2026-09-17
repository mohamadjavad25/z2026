import { getDb } from "../../connection.js";

const defaultArtistHours = [
  { day: "شنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: 1 },
  { day: "یکشنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: 1 },
  { day: "دوشنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: 1 },
  { day: "سه‌شنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: 1 },
  { day: "چهارشنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: 1 },
  { day: "پنجشنبه", open_time: "۱۰:۰۰", close_time: "۱۸:۰۰", capacity: 5, active: 1 },
  { day: "جمعه", open_time: "", close_time: "", capacity: 0, active: 0 }
];

export function ensureArtistHours(artistUserId) {
  const has = getDb().prepare("SELECT id FROM artist_hours WHERE artist_user_id = ? LIMIT 1").get(artistUserId);
  if (has) return;
  const insert = getDb().prepare(`
    INSERT INTO artist_hours (artist_user_id, day, open_time, close_time, capacity, active)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  defaultArtistHours.forEach((h) => insert.run(artistUserId, h.day, h.open_time, h.close_time, h.capacity, h.active));
}

export function listArtistHours(artistUserId) {
  ensureArtistHours(artistUserId);
  const order = new Map(defaultArtistHours.map((h, i) => [h.day, i]));
  return getDb().prepare("SELECT * FROM artist_hours WHERE artist_user_id = ?").all(artistUserId)
    .sort((a, b) => (order.get(a.day) ?? 99) - (order.get(b.day) ?? 99));
}

export function updateArtistHour(artistUserId, day, data) {
  ensureArtistHours(artistUserId);
  getDb().prepare(`
    UPDATE artist_hours SET
      open_time = COALESCE(?, open_time),
      close_time = COALESCE(?, close_time),
      capacity = COALESCE(?, capacity),
      active = COALESCE(?, active),
      updated_at = CURRENT_TIMESTAMP
    WHERE artist_user_id = ? AND day = ?
  `).run(
    data.openTime ?? data.open_time ?? null,
    data.closeTime ?? data.close_time ?? null,
    data.capacity ?? null,
    data.active === undefined ? null : (data.active ? 1 : 0),
    artistUserId,
    day
  );
  return getDb().prepare("SELECT * FROM artist_hours WHERE artist_user_id = ? AND day = ?").get(artistUserId, day);
}
