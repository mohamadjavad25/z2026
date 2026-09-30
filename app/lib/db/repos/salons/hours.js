import { getDb, all, get, run } from "../../connection.js";
import { defaultHours } from "./common.js";

export async function ensureSalonHours(salonUserId, runner = null) {
  const db = runner || (await getDb());
  const has = await get(db, "SELECT id FROM salon_hours WHERE salon_user_id = ? LIMIT 1", [salonUserId]);
  if (has) return;
  for (const h of defaultHours) {
    await run(db, `
      INSERT INTO salon_hours (salon_user_id, day, open_time, close_time, capacity, active)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (salon_user_id, day) DO NOTHING
    `, [salonUserId, h.day, h.open_time, h.close_time, h.capacity, h.active]);
  }
}

export async function listSalonHours(salonUserId, runner = null) {
  const db = runner || (await getDb());
  await ensureSalonHours(salonUserId, db);
  const order = new Map(defaultHours.map((h, i) => [h.day, i]));
  const rows = await all(db, "SELECT * FROM salon_hours WHERE salon_user_id = ?", [salonUserId]);
  return rows.sort((a, b) => (order.get(a.day) ?? 99) - (order.get(b.day) ?? 99));
}

export async function updateSalonHour(salonUserId, day, data) {
  const db = await getDb();
  await ensureSalonHours(salonUserId, db);
  await run(db, `
    UPDATE salon_hours SET
      open_time = COALESCE(?, open_time),
      close_time = COALESCE(?, close_time),
      capacity = COALESCE(?, capacity),
      active = COALESCE(?, active),
      updated_at = CURRENT_TIMESTAMP
    WHERE salon_user_id = ? AND day = ?
  `, [
    data.openTime ?? data.open_time ?? null,
    data.closeTime ?? data.close_time ?? null,
    data.capacity ?? null,
    data.active === undefined ? null : Boolean(data.active),
    salonUserId,
    day
  ]);
  return get(db, "SELECT * FROM salon_hours WHERE salon_user_id = ? AND day = ?", [salonUserId, day]);
}
