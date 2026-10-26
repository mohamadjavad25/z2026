import { withTransaction, getDb, all, get, run } from "../connection.js";
import { uploadImageDataUrl, deleteStoredImage } from "../../storage.js";
import { nameKey } from "../../businessName.js";

/**
 * Every column except the picture bytes. avatar/poster come back as a '1' / '' flag (a picture
 * exists in the row or in Storage) -- the base64 itself used to ride along on every login and
 * profile read, and it is what the media routes now fetch only when a browser really needs it.
 */
const USER_COLUMNS = `
  id, phone, password_hash, type, name, area, service, email,
  CASE WHEN avatar <> '' OR avatar_url IS NOT NULL THEN '1' ELSE '' END AS avatar,
  CASE WHEN poster <> '' OR poster_url IS NOT NULL THEN '1' ELSE '' END AS poster,
  avatar_position, poster_position, experience_years, manager_name,
  last_seen_at, created_at, updated_at, avatar_url, poster_url, suspended_at,
  geo_lat, geo_lng, address_detail
`;

export async function getUserById(id, runner = null) {
  const db = runner || (await getDb());
  return (await get(db, `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id])) || null;
}

/** Of these account ids, the suspended ones (an operator switched them off). One batch, for directory lists. */
export async function suspendedAccountIds(userIds) {
  const ids = [...new Set((userIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return new Set();
  const db = await getDb();
  const rows = await all(db, "SELECT id FROM users WHERE id = ANY($1::int[]) AND suspended_at IS NOT NULL", [ids]);
  return new Set(rows.map((row) => Number(row.id)));
}

/** Profile fields only -- avatar comes back as a present/absent flag, never the base64 bytes. */
export async function getUserLiteById(id, runner = null) {
  const db = runner || (await getDb());
  return (await get(db, `
    SELECT id, name, phone, type, area, avatar_position, (avatar <> '' OR avatar_url IS NOT NULL) AS avatar
    FROM users WHERE id = $1
  `, [id])) || null;
}

/** Public-profile fields: everything a profile page shows, avatar/poster as present/absent flags only. */
export async function getUserProfileById(id, runner = null) {
  const db = runner || (await getDb());
  return (await get(db, `
    SELECT id, name, phone, type, area, service, experience_years, avatar_position, poster_position,
      geo_lat, geo_lng, address_detail,
      (avatar <> '' OR avatar_url IS NOT NULL) AS avatar,
      (poster <> '' OR poster_url IS NOT NULL) AS poster
    FROM users WHERE id = $1
  `, [id])) || null;
}

export async function getUserByPhone(phone, runner = null) {
  const normalized = String(phone || "").trim();
  if (!normalized) return null;
  const db = runner || (await getDb());
  return (await get(db, `SELECT ${USER_COLUMNS} FROM users WHERE phone = $1`, [normalized])) || null;
}

/**
 * True when another salon or artist already holds this name (see app/lib/businessName.js for what counts as the
 * same name). `excludeUserId` is the account itself, so saving a profile without renaming never trips it.
 */
export async function isBusinessNameTaken(name, excludeUserId = 0, runner = null) {
  const key = nameKey(name);
  if (!key) return false;
  const db = runner || (await getDb());
  const rows = await all(db, "SELECT name FROM users WHERE type IN ('salon', 'artist') AND id <> $1", [Number(excludeUserId) || 0]);
  return rows.some((row) => nameKey(row.name) === key);
}

/**
 * Runs `fn(client)` while holding the lock every salon/artist name check-and-write takes. Without it two sign-ups with the
 * same name both saw "free" and both won (8 of 20 at once in the stress test). `client` is the transaction's connection:
 * run the check and the write on it, so the second caller waits, then sees the first one's name.
 */
export function withBusinessNameLock(fn) {
  return withTransaction(null, async (client) => {
    await run(client, "SELECT pg_advisory_xact_lock(hashtextextended('business-name', 0))");
    return fn(client);
  });
}

/** Gives a salon or artist a new name if no other salon or artist holds it (same rule as sign-up). false = taken. */
export async function renameBusiness(userId, name) {
  return withBusinessNameLock(async (client) => {
    if (await isBusinessNameTaken(name, userId, client)) return false;
    await run(client, "UPDATE users SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [name, userId]);
    await run(client, "UPDATE salons SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2", [name, userId]);
    return true;
  });
}

/** Records that the account proved it owns its phone number with an SMS code (see app/lib/db/clientMatch.js). */
export async function markPhoneVerified(userId) {
  const db = await getDb();
  await run(db, "UPDATE users SET phone_verified_at = COALESCE(phone_verified_at, NOW()) WHERE id = $1", [userId]);
}

export async function createUser({ phone, passwordHash, type, name, area, service, email, avatar, poster, experienceYears, managerName }, runner = null) {
  const db = runner || (await getDb());
  const info = await run(db, `
    INSERT INTO users (phone, password_hash, type, name, area, service, email, avatar, poster, experience_years, manager_name)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id
  `, [
    String(phone || "").trim(),
    passwordHash,
    type,
    name || "",
    area || "",
    service || "",
    email || "",
    avatar || "",
    poster || "",
    experienceYears || "",
    managerName || ""
  ]);
  const userId = Number(info.rows[0].id);
  if (type === "salon") {
    await run(db, `
      INSERT INTO salons (user_id, name, area, tag, phone, email)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, name || "", area || "", service || "", phone || "", email || ""]);
  }
  // Dual-write to Supabase Storage (see app/lib/storage.js and
  // migrations/008_media_storage_urls.sql) -- registration rarely
  // includes an avatar/poster (usually added later via profile edit,
  // which goes through updateUser's own dual-write below), but handled
  // here too for completeness. Best-effort: uploadImageDataUrl never
  // throws, and a failed/unconfigured upload just leaves *_url unset,
  // same as before this columns existed.
  if (avatar || poster) {
    const [avatarUrl, posterUrl] = await Promise.all([
      avatar ? uploadImageDataUrl(avatar, { kind: "avatar", ownerId: userId }) : null,
      poster ? uploadImageDataUrl(poster, { kind: "poster", ownerId: userId }) : null
    ]);
    if (avatarUrl || posterUrl) {
      // Storage has the picture now, so the base64 copy is emptied and the database stops carrying it.
      await run(db, `
        UPDATE users SET
          avatar = CASE WHEN $1::text IS NOT NULL THEN '' ELSE avatar END,
          poster = CASE WHEN $2::text IS NOT NULL THEN '' ELSE poster END,
          avatar_url = COALESCE($1, avatar_url), poster_url = COALESCE($2, poster_url)
        WHERE id = $3
      `, [avatarUrl, posterUrl, userId]);
    }
  }
  return getUserById(userId, db);
}

const isDataImage = (value) => typeof value === "string" && value.startsWith("data:image/");

/**
 * What to store for one picture field of a profile edit. undefined/null (or anything that is not a
 * fresh data URL, e.g. a media URL echoed back) keeps what is there; "" removes it; a new data URL
 * goes to Storage and, once it is there, only the URL is kept -- if Storage is off or fails, the
 * base64 stays in the row exactly as before, so a save never loses a picture.
 */
async function planPicture(value, kind, ownerId) {
  if (value == null || (value !== "" && !isDataImage(value))) return { change: false, blob: "", url: null };
  if (value === "") return { change: true, blob: "", url: null };
  const url = await uploadImageDataUrl(value, { kind, ownerId });
  return url ? { change: true, blob: "", url } : { change: true, blob: value, url: null };
}

export async function updateUser(id, data) {
  const db = await getDb();
  const current = await getUserById(id, db);
  if (!current) return null;
  const next = {
    phone: data.phone ?? current.phone,
    name: data.name ?? current.name,
    area: data.area ?? current.area,
    service: data.service ?? current.service,
    email: data.email ?? current.email,
    avatar_position: data.avatarPosition ?? data.avatar_position ?? current.avatar_position ?? "",
    poster_position: data.posterPosition ?? data.poster_position ?? current.poster_position ?? "",
    experience_years: data.experienceYears ?? data.experience_years ?? current.experience_years ?? "",
    manager_name: data.managerName ?? data.manager_name ?? current.manager_name ?? "",
    password_hash: data.password_hash ?? current.password_hash,
    address_detail: data.addressDetail ?? current.address_detail ?? ""
  };
  // The map pin: undefined keeps it, null removes it, { lat, lng } moves it.
  const geo = data.geo === undefined
    ? { lat: current.geo_lat ?? null, lng: current.geo_lng ?? null }
    : { lat: data.geo?.lat ?? null, lng: data.geo?.lng ?? null };

  const [avatar, poster] = await Promise.all([
    planPicture(data.avatar, "avatar", id),
    planPicture(data.poster, "poster", id)
  ]);

  await run(db, `
    UPDATE users SET
      phone = $1, name = $2, area = $3, service = $4, email = $5,
      avatar = CASE WHEN $6 THEN $7 ELSE avatar END, avatar_url = CASE WHEN $6 THEN $8 ELSE avatar_url END,
      poster = CASE WHEN $9 THEN $10 ELSE poster END, poster_url = CASE WHEN $9 THEN $11 ELSE poster_url END,
      avatar_position = $12, poster_position = $13, experience_years = $14, manager_name = $15, password_hash = $16,
      geo_lat = $18, geo_lng = $19, address_detail = $20,
      -- A new number is only "verified" when the caller proved it with a code; the old number's proof never carries over.
      phone_verified_at = CASE WHEN $21 THEN CASE WHEN $22 THEN NOW() ELSE NULL END ELSE phone_verified_at END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $17
  `, [
    next.phone, next.name, next.area, next.service, next.email,
    avatar.change, avatar.blob, avatar.url,
    poster.change, poster.blob, poster.url,
    next.avatar_position, next.poster_position, next.experience_years, next.manager_name, next.password_hash, id,
    geo.lat, geo.lng, next.address_detail,
    next.phone !== current.phone, data.phoneVerified === true
  ]);

  // The replaced/removed pictures no longer need their Storage copies.
  if (avatar.change && current.avatar_url) await deleteStoredImage(current.avatar_url);
  if (poster.change && current.poster_url) await deleteStoredImage(current.poster_url);

  if (current.type === "salon") {
    await run(db, `
      UPDATE salons SET name = $1, area = $2, tag = $3, phone = $4, email = $5, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $6
    `, [next.name, next.area, next.service, next.phone, next.email, id]);
  }
  return getUserById(id, db);
}

export async function listUsersByType(type) {
  const db = await getDb();
  return all(db, `SELECT ${USER_COLUMNS} FROM users WHERE type = $1 ORDER BY created_at DESC`, [type]);
}

export async function countFollowers(userId, runner = null) {
  const db = runner || (await getDb());
  const row = await get(db, "SELECT COUNT(*) AS c FROM follows WHERE target_user_id = $1", [userId]);
  return Number(row?.c || 0);
}

/** Follower / following counts for many users in two grouped queries (no per-row round trips). */
export async function countFollowCountsMany(userIds, runner = null) {
  const ids = [...new Set(userIds.map(Number).filter(Boolean))];
  const followers = new Map();
  const following = new Map();
  if (!ids.length) return { followers, following };
  const db = runner || (await getDb());
  const [followerRows, followingRows] = await Promise.all([
    all(db, "SELECT target_user_id AS id, COUNT(*) AS c FROM follows WHERE target_user_id = ANY($1) GROUP BY target_user_id", [ids]),
    all(db, "SELECT follower_user_id AS id, COUNT(*) AS c FROM follows WHERE follower_user_id = ANY($1) GROUP BY follower_user_id", [ids])
  ]);
  followerRows.forEach((row) => followers.set(Number(row.id), Number(row.c)));
  followingRows.forEach((row) => following.set(Number(row.id), Number(row.c)));
  return { followers, following };
}

export async function isFollowing(followerId, targetId, runner = null) {
  if (!followerId || !targetId) return false;
  const db = runner || (await getDb());
  return Boolean(
    await get(db, "SELECT 1 FROM follows WHERE follower_user_id = $1 AND target_user_id = $2", [followerId, targetId])
  );
}

/**
 * Deletes an account for good, and first cuts its phone number off every booking it left behind (owner's decision
 * 2026-10-22): the account's own bookings, and the walk-ins a salon or artist typed for that number, lose the
 * number (the name and the visit stay for the salon's own records). So whoever takes the number over later sees
 * nothing of the previous person's bookings. Returns the deleted row ({ id, phone, name, type }) or null.
 */
export async function deleteUserDetachingPhone(id) {
  const userId = Number(id);
  return withTransaction(null, async (client) => {
    const row = await get(client, "SELECT id, phone, name, type, phone_verified_at FROM users WHERE id = $1 FOR UPDATE", [userId]);
    if (!row) return null;
    // Walk-ins typed for the bare number are cut off only when this account had proved it owns the number (SMS code):
    // an unverified sign-up with someone else's number must not be able to wipe the real person's bookings by deleting itself.
    const key = row.phone_verified_at ? String(row.phone || "").trim() : "";
    for (const [table, column] of [["salon_bookings", "phone"], ["artist_bookings", "client_phone"]]) {
      await run(client, `
        UPDATE ${table} SET ${column} = ''
        WHERE client_user_id = $1 OR ($2 <> '' AND client_user_id IS NULL AND phone_normalized = frfro_phone_key($2))
      `, [userId, key]);
    }
    await run(client, "DELETE FROM users WHERE id = $1", [userId]);
    return row;
  });
}

/**
 * Before an account's number changes (owner's decision of 2026-10-25): the walk-ins a salon or artist typed for the
 * OLD number until now are tied to the account for good, so the history stays with the person. Rows typed later for
 * the old number belong to whoever has that number then. Only when the account had proved the old number (SMS code),
 * the same bar the client's booking list uses.
 */
export async function lockOldNumberBookings(userId) {
  const db = await getDb();
  const row = await get(db, "SELECT phone, phone_verified_at FROM users WHERE id = $1", [Number(userId)]);
  const key = row?.phone_verified_at ? String(row.phone || "").trim() : "";
  if (!key) return;
  for (const table of ["salon_bookings", "artist_bookings"]) {
    await run(db, `UPDATE ${table} SET client_user_id = $1 WHERE client_user_id IS NULL AND phone_normalized = frfro_phone_key($2)`, [Number(userId), key]);
  }
}
