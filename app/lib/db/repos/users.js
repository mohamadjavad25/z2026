import { getDb } from "../connection.js";

export function getUserById(id) {
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) || null;
}

export function getUserByPhone(phone) {
  const normalized = String(phone || "").trim();
  if (!normalized) return null;
  return getDb().prepare("SELECT * FROM users WHERE phone = ?").get(normalized) || null;
}

export function createUser({ phone, passwordHash, type, name, area, service, email, avatar, bio, experienceYears, managerName }) {
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO users (phone, password_hash, type, name, area, service, email, avatar, bio, experience_years, manager_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(phone || "").trim(),
    passwordHash,
    type,
    name || "",
    area || "",
    service || "",
    email || "",
    avatar || "",
    bio || "",
    experienceYears || "",
    managerName || ""
  );
  const userId = Number(info.lastInsertRowid);
  if (type === "salon") {
    db.prepare(`
      INSERT INTO salons (user_id, name, area, tag, phone, email)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, name || "", area || "", service || "", phone || "", email || "");
  }
  return getUserById(userId);
}

export function updateUser(id, data) {
  const db = getDb();
  const current = getUserById(id);
  if (!current) return null;
  const next = {
    phone: data.phone ?? current.phone,
    name: data.name ?? current.name,
    area: data.area ?? current.area,
    service: data.service ?? current.service,
    email: data.email ?? current.email,
    avatar: data.avatar ?? current.avatar,
    bio: data.bio ?? current.bio,
    experience_years: data.experienceYears ?? data.experience_years ?? current.experience_years ?? "",
    manager_name: data.managerName ?? data.manager_name ?? current.manager_name ?? "",
    password_hash: data.password_hash ?? current.password_hash
  };
  db.prepare(`
    UPDATE users SET
      phone = ?, name = ?, area = ?, service = ?, email = ?, avatar = ?, bio = ?, experience_years = ?, manager_name = ?, password_hash = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(next.phone, next.name, next.area, next.service, next.email, next.avatar, next.bio, next.experience_years, next.manager_name, next.password_hash, id);

  if (current.type === "salon") {
    db.prepare(`
      UPDATE salons SET name = ?, area = ?, tag = ?, phone = ?, email = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(next.name, next.area, next.service, next.phone, next.email, id);
  }
  return getUserById(id);
}

export function listUsersByType(type) {
  return getDb().prepare("SELECT * FROM users WHERE type = ? ORDER BY created_at DESC").all(type);
}

export function countFollowers(userId) {
  const row = getDb().prepare("SELECT COUNT(*) AS c FROM follows WHERE target_user_id = ?").get(userId);
  return Number(row?.c || 0);
}

export function isFollowing(followerId, targetId) {
  if (!followerId || !targetId) return false;
  return Boolean(
    getDb().prepare("SELECT 1 FROM follows WHERE follower_user_id = ? AND target_user_id = ?").get(followerId, targetId)
  );
}

