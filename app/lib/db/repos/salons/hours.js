import { getDb } from "../../connection.js";
import { defaultHours } from "./common.js";
export function ensureSalonHours(salonUserId) {
  const has = getDb().prepare("SELECT id FROM salon_hours WHERE salon_user_id = ? LIMIT 1").get(salonUserId);
  if (has) return;
  const insert = getDb().prepare(`
    INSERT INTO salon_hours (salon_user_id, day, open_time, close_time, capacity, active)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  defaultHours.forEach((h) => insert.run(salonUserId, h.day, h.open_time, h.close_time, h.capacity, h.active));
}

export function listSalonHours(salonUserId) {
  ensureSalonHours(salonUserId);
  const order = new Map(defaultHours.map((h, i) => [h.day, i]));
  return getDb().prepare("SELECT * FROM salon_hours WHERE salon_user_id = ?").all(salonUserId)
    .sort((a, b) => (order.get(a.day) ?? 99) - (order.get(b.day) ?? 99));
}

export function updateSalonHour(salonUserId, day, data) {
  ensureSalonHours(salonUserId);
  getDb().prepare(`
    UPDATE salon_hours SET
      open_time = COALESCE(?, open_time),
      close_time = COALESCE(?, close_time),
      capacity = COALESCE(?, capacity),
      active = COALESCE(?, active),
      updated_at = CURRENT_TIMESTAMP
    WHERE salon_user_id = ? AND day = ?
  `).run(
    data.openTime ?? data.open_time ?? null,
    data.closeTime ?? data.close_time ?? null,
    data.capacity ?? null,
    data.active === undefined ? null : (data.active ? 1 : 0),
    salonUserId,
    day
  );
  return getDb().prepare("SELECT * FROM salon_hours WHERE salon_user_id = ? AND day = ?").get(salonUserId, day);
}
