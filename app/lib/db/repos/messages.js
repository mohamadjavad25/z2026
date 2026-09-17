import { getDb, withTransaction } from "../connection.js";

const MAX_GROUP_MEMBERS = 50;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TITLE_LENGTH = 60;
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

function isMember(db, conversationId, userId) {
  return Boolean(
    db.prepare("SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?").get(conversationId, userId)
  );
}

function memberIds(db, conversationId) {
  return db.prepare("SELECT user_id FROM conversation_members WHERE conversation_id = ?").all(conversationId).map((r) => r.user_id);
}

/** Finds an existing 2-person "direct" conversation between userA/userB, or creates one. */
export function getOrCreateDirectConversation(userA, userB) {
  const db = getDb();
  const a = Number(userA);
  const b = Number(userB);
  if (!a || !b || a === b) return null;

  const existing = db.prepare(`
    SELECT cm1.conversation_id AS id
    FROM conversation_members cm1
    JOIN conversation_members cm2 ON cm2.conversation_id = cm1.conversation_id AND cm2.user_id = ?
    JOIN conversations c ON c.id = cm1.conversation_id AND c.type = 'direct'
    WHERE cm1.user_id = ?
      AND (SELECT COUNT(*) FROM conversation_members cm3 WHERE cm3.conversation_id = cm1.conversation_id) = 2
    LIMIT 1
  `).get(b, a);
  if (existing) return getConversation(existing.id, a);

  return withTransaction(db, () => {
    const info = db.prepare(
      "INSERT INTO conversations (type, title, created_by) VALUES ('direct', '', ?)"
    ).run(a);
    const conversationId = Number(info.lastInsertRowid);
    db.prepare("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)").run(conversationId, a);
    db.prepare("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)").run(conversationId, b);
    return getConversation(conversationId, a);
  });
}

/** Creates a named "group" conversation. Creator is always a member; memberUserIds are added alongside. */
export function createGroupConversation(creatorId, title, memberUserIds = []) {
  const db = getDb();
  const trimmedTitle = String(title || "").trim().slice(0, MAX_TITLE_LENGTH);
  if (!trimmedTitle) return { ok: false, error: "نام گروه لازم است." };

  const uniqueMembers = [...new Set(memberUserIds.map(Number).filter((id) => Number.isFinite(id) && id !== creatorId))];
  if (uniqueMembers.length === 0) return { ok: false, error: "حداقل یک عضو دیگر برای گروه لازم است." };
  if (uniqueMembers.length + 1 > MAX_GROUP_MEMBERS) return { ok: false, error: `گروه حداکثر ${MAX_GROUP_MEMBERS} عضو می‌تواند داشته باشد.` };

  const existingUsers = db.prepare(
    `SELECT id FROM users WHERE id IN (${uniqueMembers.map(() => "?").join(",")})`
  ).all(...uniqueMembers);
  if (existingUsers.length !== uniqueMembers.length) return { ok: false, error: "یکی از اعضا پیدا نشد." };

  return withTransaction(db, () => {
    const info = db.prepare(
      "INSERT INTO conversations (type, title, created_by) VALUES ('group', ?, ?)"
    ).run(trimmedTitle, creatorId);
    const conversationId = Number(info.lastInsertRowid);
    const insertMember = db.prepare("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)");
    insertMember.run(conversationId, creatorId);
    for (const id of uniqueMembers) insertMember.run(conversationId, id);
    return { ok: true, conversation: getConversation(conversationId, creatorId) };
  });
}

/** Adds members to a group. Any current member can invite; direct conversations can't be grown. */
export function addMembers(conversationId, actorUserId, newMemberIds = []) {
  const db = getDb();
  const convo = db.prepare("SELECT * FROM conversations WHERE id = ?").get(conversationId);
  if (!convo) return { ok: false, error: "گفتگو پیدا نشد.", code: "NOT_FOUND" };
  if (!isMember(db, conversationId, actorUserId)) return { ok: false, error: "دسترسی نداری.", code: "FORBIDDEN" };
  if (convo.type !== "group") return { ok: false, error: "این گفتگو گروهی نیست." };

  const current = memberIds(db, conversationId);
  const uniqueNew = [...new Set(newMemberIds.map(Number).filter((id) => Number.isFinite(id) && !current.includes(id)))];
  if (uniqueNew.length === 0) return { ok: false, error: "عضو جدیدی برای افزودن نیست." };
  if (current.length + uniqueNew.length > MAX_GROUP_MEMBERS) return { ok: false, error: `گروه حداکثر ${MAX_GROUP_MEMBERS} عضو می‌تواند داشته باشد.` };

  const existingUsers = db.prepare(
    `SELECT id FROM users WHERE id IN (${uniqueNew.map(() => "?").join(",")})`
  ).all(...uniqueNew);
  if (existingUsers.length !== uniqueNew.length) return { ok: false, error: "یکی از اعضا پیدا نشد." };

  return withTransaction(db, () => {
    const insertMember = db.prepare("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)");
    for (const id of uniqueNew) insertMember.run(conversationId, id);
    return { ok: true, conversation: getConversation(conversationId, actorUserId) };
  });
}

/** Removes a member. Anyone can remove themselves (leave); only the creator can remove someone else. */
export function removeMember(conversationId, actorUserId, targetUserId) {
  const db = getDb();
  const convo = db.prepare("SELECT * FROM conversations WHERE id = ?").get(conversationId);
  if (!convo) return { ok: false, error: "گفتگو پیدا نشد.", code: "NOT_FOUND" };
  if (!isMember(db, conversationId, actorUserId)) return { ok: false, error: "دسترسی نداری.", code: "FORBIDDEN" };
  const target = Number(targetUserId);
  if (target !== actorUserId && convo.created_by !== actorUserId) {
    return { ok: false, error: "فقط سازنده گروه می‌تواند عضو دیگری را حذف کند.", code: "FORBIDDEN" };
  }
  if (convo.type === "direct") return { ok: false, error: "از گفتگوی مستقیم نمی‌توان خارج شد." };

  db.prepare("DELETE FROM conversation_members WHERE conversation_id = ? AND user_id = ?").run(conversationId, target);
  const remaining = memberIds(db, conversationId);
  if (remaining.length === 0) {
    db.prepare("DELETE FROM conversations WHERE id = ?").run(conversationId);
    return { ok: true, deleted: true };
  }
  return { ok: true, deleted: false };
}

/** Renames a group conversation. Any member may rename. */
export function renameGroup(conversationId, userId, title) {
  const db = getDb();
  const convo = db.prepare("SELECT * FROM conversations WHERE id = ?").get(conversationId);
  if (!convo) return { ok: false, error: "گفتگو پیدا نشد.", code: "NOT_FOUND" };
  if (!isMember(db, conversationId, userId)) return { ok: false, error: "دسترسی نداری.", code: "FORBIDDEN" };
  if (convo.type !== "group") return { ok: false, error: "این گفتگو گروهی نیست." };
  const trimmedTitle = String(title || "").trim().slice(0, MAX_TITLE_LENGTH);
  if (!trimmedTitle) return { ok: false, error: "نام گروه لازم است." };
  db.prepare("UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(trimmedTitle, conversationId);
  return { ok: true, conversation: getConversation(conversationId, userId) };
}

/** One conversation's detail (peer info for direct, title+members for group), or null if not a member. */
export function getConversation(conversationId, userId) {
  const db = getDb();
  const convo = db.prepare("SELECT * FROM conversations WHERE id = ?").get(conversationId);
  if (!convo || !isMember(db, conversationId, userId)) return null;

  const members = db.prepare(`
    SELECT u.id, u.name, u.avatar, u.type
    FROM conversation_members cm JOIN users u ON u.id = cm.user_id
    WHERE cm.conversation_id = ?
  `).all(conversationId);

  const peer = convo.type === "direct" ? members.find((m) => m.id !== userId) || null : null;

  return {
    id: convo.id,
    type: convo.type,
    title: convo.type === "group" ? convo.title : (peer?.name || ""),
    avatar: convo.type === "group" ? convo.avatar : (peer?.avatar || ""),
    createdBy: convo.created_by,
    isCreator: convo.created_by === userId,
    peer: peer ? { id: peer.id, name: peer.name, avatar: peer.avatar, type: peer.type } : null,
    members: convo.type === "group" ? members.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, type: m.type })) : undefined,
    createdAt: convo.created_at,
    updatedAt: convo.updated_at
  };
}

/** Every conversation `userId` belongs to, newest activity first, with peer/group info + last message + unread count. Cursor-paginated on updated_at. */
export function listConversations(userId, { limit = DEFAULT_PAGE_SIZE, cursor } = {}) {
  const db = getDb();
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  const rows = db.prepare(`
    SELECT c.id, c.type, c.title, c.avatar, c.created_by, c.updated_at,
      cm.last_read_at,
      (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
      (SELECT attachment_type FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message_attachment_type,
      (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message_at,
      (SELECT sender_user_id FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message_sender,
      (
        SELECT COUNT(*) FROM messages m
        WHERE m.conversation_id = c.id AND m.sender_user_id != ? AND m.created_at > cm.last_read_at
      ) AS unread_count
    FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ?
    ${cursor ? "WHERE c.updated_at < (SELECT updated_at FROM conversations WHERE id = ?)" : ""}
    ORDER BY c.updated_at DESC
    LIMIT ?
  `).all(...(cursor ? [userId, userId, cursor, safeLimit + 1] : [userId, userId, safeLimit + 1]));

  const hasMore = rows.length > safeLimit;
  const page = rows.slice(0, safeLimit);

  const directPeerRows = page.filter((r) => r.type === "direct");
  const peerByConversation = new Map();
  if (directPeerRows.length) {
    const ids = directPeerRows.map((r) => r.id);
    const peers = db.prepare(`
      SELECT cm.conversation_id, u.id, u.name, u.avatar, u.type
      FROM conversation_members cm JOIN users u ON u.id = cm.user_id
      WHERE cm.conversation_id IN (${ids.map(() => "?").join(",")}) AND cm.user_id != ?
    `).all(...ids, userId);
    for (const p of peers) peerByConversation.set(p.conversation_id, p);
  }

  const conversations = page.map((row) => {
    const peer = peerByConversation.get(row.id) || null;
    return {
      id: row.id,
      type: row.type,
      title: row.type === "group" ? row.title : (peer?.name || ""),
      avatar: row.type === "group" ? row.avatar : (peer?.avatar || ""),
      peer: peer ? { id: peer.id, name: peer.name, avatar: peer.avatar, type: peer.type } : null,
      lastMessage: row.last_message || "",
      lastMessageAttachmentType: row.last_message_attachment_type || "",
      lastMessageAt: row.last_message_at || row.updated_at,
      lastMessageIsMine: row.last_message_sender === userId,
      unreadCount: row.unread_count,
      updatedAt: row.updated_at
    };
  });

  return { conversations, nextCursor: hasMore ? page[page.length - 1].id : null };
}

/** Marks every message in the conversation as read by userId (moves their last_read_at forward). Returns false if not a member. */
export function markConversationRead(conversationId, userId) {
  const db = getDb();
  if (!isMember(db, conversationId, userId)) return false;
  db.prepare(
    "UPDATE conversation_members SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?"
  ).run(conversationId, userId);
  return true;
}

/** Paginated messages, oldest-first within the returned page. `before` (a message id) fetches older history. */
export function listMessages(conversationId, userId, { limit = DEFAULT_PAGE_SIZE, before } = {}) {
  const db = getDb();
  if (!isMember(db, conversationId, userId)) return null;
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  const rows = db.prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ? ${before ? "AND id < ?" : ""}
    ORDER BY id DESC
    LIMIT ?
  `).all(...(before ? [conversationId, before, safeLimit + 1] : [conversationId, safeLimit + 1]));

  const hasMore = rows.length > safeLimit;
  const page = rows.slice(0, safeLimit).reverse();
  return {
    messages: page.map(mapMessage),
    nextCursor: hasMore ? page[0]?.id ?? null : null
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderUserId: row.sender_user_id,
    body: row.body,
    attachmentUrl: row.attachment_url || "",
    attachmentType: row.attachment_type || "",
    orderRefId: row.order_ref_id || null,
    createdAt: row.created_at
  };
}

export function sendMessage(conversationId, senderUserId, { body = "", attachmentUrl = "", attachmentType = "" } = {}) {
  const db = getDb();
  if (!isMember(db, conversationId, senderUserId)) return { ok: false, error: "forbidden" };
  const trimmedBody = String(body || "").trim();
  if (!trimmedBody && !attachmentUrl) return { ok: false, error: "پیام خالی است." };
  if (trimmedBody.length > MAX_MESSAGE_LENGTH) return { ok: false, error: "پیام خیلی طولانی است." };

  return withTransaction(db, () => {
    const info = db.prepare(`
      INSERT INTO messages (conversation_id, sender_user_id, body, attachment_url, attachment_type)
      VALUES (?, ?, ?, ?, ?)
    `).run(conversationId, senderUserId, trimmedBody, attachmentUrl || "", attachmentType || "");
    db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(conversationId);
    const message = mapMessage(db.prepare("SELECT * FROM messages WHERE id = ?").get(Number(info.lastInsertRowid)));
    const recipients = memberIds(db, conversationId);
    return { ok: true, message, recipients };
  });
}

/**
 * Sends an automatic "order card" message — a receipt-style bubble linked
 * to a real shop_orders row, sent right after checkout so the buyer has an
 * in-chat way to track the order (image/name/price + live status, since the
 * conversation API's caller enriches this with fresh order data on every
 * fetch — see /api/conversations/[id]/messages).
 */
export function sendOrderCardMessage(conversationId, senderUserId, orderId) {
  const db = getDb();
  if (!isMember(db, conversationId, senderUserId)) return { ok: false, error: "forbidden" };
  return withTransaction(db, () => {
    const info = db.prepare(`
      INSERT INTO messages (conversation_id, sender_user_id, attachment_type, order_ref_id)
      VALUES (?, ?, 'order', ?)
    `).run(conversationId, senderUserId, orderId);
    db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(conversationId);
    const message = mapMessage(db.prepare("SELECT * FROM messages WHERE id = ?").get(Number(info.lastInsertRowid)));
    const recipients = memberIds(db, conversationId);
    return { ok: true, message, recipients };
  });
}

export { MAX_MESSAGE_LENGTH, MAX_TITLE_LENGTH, MAX_GROUP_MEMBERS };
