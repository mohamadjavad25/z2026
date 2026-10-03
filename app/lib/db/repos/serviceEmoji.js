import { isBeautyEmojiId } from "../../../shared/constants/beautyEmoji.js";

/** Only known icon ids are persisted; anything else becomes "" (no icon). */
export function normalizeServiceEmoji(value) {
  const id = String(value || "").trim();
  return isBeautyEmojiId(id) ? id : "";
}

/**
 * Icon id for a booking's service, taken from the owner's service of the same
 * name (artist: artist_services.user_id, salon: salon_services.salon_user_id).
 * An explicit, valid `explicit` id wins. Returns "" when nothing matches.
 */
export async function resolveBookingServiceEmoji(db, { kind, ownerId, service, explicit = "" }) {
  const direct = normalizeServiceEmoji(explicit);
  if (direct) return direct;
  const name = String(service || "").trim();
  if (!name || !ownerId) return "";
  const table = kind === "salon" ? "salon_services" : "artist_services";
  const column = kind === "salon" ? "salon_user_id" : "user_id";
  const { rows } = await db.query(
    `SELECT emoji FROM ${table} WHERE ${column} = $1 AND name = $2 AND emoji <> '' ORDER BY id LIMIT 1`,
    [ownerId, name]
  );
  return normalizeServiceEmoji(rows[0]?.emoji);
}
