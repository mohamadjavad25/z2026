import { getDb, get, run } from "../connection.js";

export async function getPassport(userId) {
  const db = await getDb();
  return (await get(db, "SELECT * FROM beauty_passports WHERE user_id = ?", [userId])) || null;
}

export async function savePassport(userId, data = {}) {
  const db = await getDb();
  const expires = new Date();
  expires.setMonth(expires.getMonth() + 1);
  await run(db, `
    INSERT INTO beauty_passports
      (user_id, active, skin_tone, undertone, face_shape, hair_type, signature, summary, expires_at)
    VALUES (?, true, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      active = true,
      skin_tone = excluded.skin_tone,
      undertone = excluded.undertone,
      face_shape = excluded.face_shape,
      hair_type = excluded.hair_type,
      signature = excluded.signature,
      summary = excluded.summary,
      expires_at = excluded.expires_at,
      updated_at = CURRENT_TIMESTAMP
  `, [
    userId,
    data.skinTone || data.skin_tone || "متوسط گرم",
    data.undertone || "گرم",
    data.faceShape || data.face_shape || "بیضی",
    data.hairType || data.hair_type || "موج‌دار",
    data.signature || "نود گلو",
    data.summary || "پروفایل زیبایی شخصی‌سازی‌شده برای پیشنهاد مدل و رزرو دقیق‌تر.",
    expires.toISOString()
  ]);
  return getPassport(userId);
}
