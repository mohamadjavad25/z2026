import { getDb, all, get, run } from "../connection.js";
import { uploadImageDataUrl } from "../../storage.js";

export async function getUserById(id, runner = null) {
  const db = runner || (await getDb());
  return (await get(db, "SELECT * FROM users WHERE id = $1", [id])) || null;
}

/** Profile fields only -- avatar comes back as a present/absent flag, never the base64 bytes. */
export async function getUserLiteById(id, runner = null) {
  const db = runner || (await getDb());
  return (await get(db, `
    SELECT id, name, phone, type, area, bio, avatar_position, (avatar <> '') AS avatar
    FROM users WHERE id = $1
  `, [id])) || null;
}

/** Public-profile fields: everything a profile page shows, avatar as a flag only. */
export async function getUserProfileById(id, runner = null) {
  const db = runner || (await getDb());
  return (await get(db, `
    SELECT id, name, phone, type, area, service, bio, experience_years, avatar_position, (avatar <> '') AS avatar
    FROM users WHERE id = $1
  `, [id])) || null;
}

export async function getUserByPhone(phone, runner = null) {
  const normalized = String(phone || "").trim();
  if (!normalized) return null;
  const db = runner || (await getDb());
  return (await get(db, "SELECT * FROM users WHERE phone = $1", [normalized])) || null;
}

export async function createUser({ phone, passwordHash, type, name, area, service, email, avatar, poster, bio, experienceYears, managerName }) {
  const db = await getDb();
  const info = await run(db, `
    INSERT INTO users (phone, password_hash, type, name, area, service, email, avatar, poster, bio, experience_years, manager_name)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
    bio || "",
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
      await run(db, `
        UPDATE users SET avatar_url = COALESCE($1, avatar_url), poster_url = COALESCE($2, poster_url) WHERE id = $3
      `, [avatarUrl, posterUrl, userId]);
    }
  }
  return getUserById(userId, db);
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
    avatar: data.avatar ?? current.avatar,
    poster: data.poster ?? current.poster,
    avatar_position: data.avatarPosition ?? data.avatar_position ?? current.avatar_position ?? "",
    poster_position: data.posterPosition ?? data.poster_position ?? current.poster_position ?? "",
    bio: data.bio ?? current.bio,
    experience_years: data.experienceYears ?? data.experience_years ?? current.experience_years ?? "",
    manager_name: data.managerName ?? data.manager_name ?? current.manager_name ?? "",
    password_hash: data.password_hash ?? current.password_hash
  };

  // Dual-write to Supabase Storage (see app/lib/storage.js) -- only when
  // avatar/poster is genuinely changing (a fresh "data:..." string, not
  // the unchanged current value): re-uploading on every unrelated
  // profile edit would be wasted work and would race the *_url column
  // against nothing having actually changed. Removal (empty string)
  // clears the URL too; leaving the field untouched (data.avatar
  // undefined) leaves *_url untouched as well.
  let avatarUrl = current.avatar_url;
  if (data.avatar !== undefined && data.avatar !== current.avatar) {
    avatarUrl = data.avatar ? await uploadImageDataUrl(data.avatar, { kind: "avatar", ownerId: id }) : null;
  }
  let posterUrl = current.poster_url;
  if (data.poster !== undefined && data.poster !== current.poster) {
    posterUrl = data.poster ? await uploadImageDataUrl(data.poster, { kind: "poster", ownerId: id }) : null;
  }

  await run(db, `
    UPDATE users SET
      phone = $1, name = $2, area = $3, service = $4, email = $5, avatar = $6, poster = $7, avatar_url = $8, poster_url = $9, avatar_position = $10, poster_position = $11, bio = $12, experience_years = $13, manager_name = $14, password_hash = $15,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $16
  `, [next.phone, next.name, next.area, next.service, next.email, next.avatar, next.poster, avatarUrl, posterUrl, next.avatar_position, next.poster_position, next.bio, next.experience_years, next.manager_name, next.password_hash, id]);

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
  return all(db, "SELECT * FROM users WHERE type = $1 ORDER BY created_at DESC", [type]);
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
