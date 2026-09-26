import { getDb, all, get, run } from "../connection.js";

export async function getUserById(id, runner = null) {
  const db = runner || (await getDb());
  return (await get(db, "SELECT * FROM users WHERE id = ?", [id])) || null;
}

export async function getUserByPhone(phone, runner = null) {
  const normalized = String(phone || "").trim();
  if (!normalized) return null;
  const db = runner || (await getDb());
  return (await get(db, "SELECT * FROM users WHERE phone = ?", [normalized])) || null;
}

export async function createUser({ phone, passwordHash, type, name, area, service, email, avatar, poster, bio, experienceYears, managerName }) {
  const db = await getDb();
  const info = await run(db, `
    INSERT INTO users (phone, password_hash, type, name, area, service, email, avatar, poster, bio, experience_years, manager_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, name || "", area || "", service || "", phone || "", email || ""]);
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
  await run(db, `
    UPDATE users SET
      phone = ?, name = ?, area = ?, service = ?, email = ?, avatar = ?, poster = ?, avatar_position = ?, poster_position = ?, bio = ?, experience_years = ?, manager_name = ?, password_hash = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [next.phone, next.name, next.area, next.service, next.email, next.avatar, next.poster, next.avatar_position, next.poster_position, next.bio, next.experience_years, next.manager_name, next.password_hash, id]);

  if (current.type === "salon") {
    await run(db, `
      UPDATE salons SET name = ?, area = ?, tag = ?, phone = ?, email = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `, [next.name, next.area, next.service, next.phone, next.email, id]);
  }
  return getUserById(id, db);
}

export async function listUsersByType(type) {
  const db = await getDb();
  return all(db, "SELECT * FROM users WHERE type = ? ORDER BY created_at DESC", [type]);
}

export async function countFollowers(userId, runner = null) {
  const db = runner || (await getDb());
  const row = await get(db, "SELECT COUNT(*) AS c FROM follows WHERE target_user_id = ?", [userId]);
  return Number(row?.c || 0);
}

export async function isFollowing(followerId, targetId, runner = null) {
  if (!followerId || !targetId) return false;
  const db = runner || (await getDb());
  return Boolean(
    await get(db, "SELECT 1 FROM follows WHERE follower_user_id = ? AND target_user_id = ?", [followerId, targetId])
  );
}
