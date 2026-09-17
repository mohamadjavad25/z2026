import { getDb } from "../connection.js";

export function getPassport(userId) {
  return getDb().prepare("SELECT * FROM beauty_passports WHERE user_id = ?").get(userId) || null;
}

export function savePassport(userId, data = {}) {
  const expires = new Date();
  expires.setMonth(expires.getMonth() + 1);
  getDb().prepare(`
    INSERT INTO beauty_passports
      (user_id, active, skin_tone, undertone, face_shape, hair_type, signature, summary, expires_at)
    VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      active = 1,
      skin_tone = excluded.skin_tone,
      undertone = excluded.undertone,
      face_shape = excluded.face_shape,
      hair_type = excluded.hair_type,
      signature = excluded.signature,
      summary = excluded.summary,
      expires_at = excluded.expires_at,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    userId,
    data.skinTone || data.skin_tone || "متوسط گرم",
    data.undertone || "گرم",
    data.faceShape || data.face_shape || "بیضی",
    data.hairType || data.hair_type || "موج‌دار",
    data.signature || "نود گلو",
    data.summary || "پروفایل زیبایی شخصی‌سازی‌شده برای پیشنهاد مدل و رزرو دقیق‌تر.",
    expires.toISOString()
  );
  return getPassport(userId);
}
