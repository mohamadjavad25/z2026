import { apiFetch, apiJson } from "./client";

/** GET /api/conversations → { data: { conversations, nextCursor } } */
export async function listConversations({ cursor, limit } = {}) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (limit) params.set("limit", limit);
  const query = params.toString();
  return apiJson(`/api/conversations${query ? `?${query}` : ""}`);
}

/** POST /api/conversations → { data: { conversation } } — direct chat (peerUserId) or group (type:"group", title, memberIds) */
export async function createConversation(body) {
  return apiFetch("/api/conversations", { method: "POST", body: JSON.stringify(body) });
}

/** GET /api/conversations/:id → { data: { conversation } } — includes members for a group */
export async function getConversation(id) {
  return apiJson(`/api/conversations/${id}`);
}

/** PATCH /api/conversations/:id — { title } to rename, or { addMemberIds } to invite */
export async function updateConversation(id, body) {
  return apiFetch(`/api/conversations/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

/** DELETE /api/conversations/:id — { userId? } to remove someone (creator only) or leave (defaults to self) */
export async function leaveConversation(id, userId) {
  return apiFetch(`/api/conversations/${id}`, {
    method: "DELETE",
    body: JSON.stringify(userId ? { userId } : {})
  });
}

/** GET /api/conversations/:id/messages → { data: { messages, nextCursor } } */
export async function getConversationMessages(id, { before, limit } = {}) {
  const params = new URLSearchParams();
  if (before) params.set("before", before);
  if (limit) params.set("limit", limit);
  const query = params.toString();
  return apiJson(`/api/conversations/${id}/messages${query ? `?${query}` : ""}`);
}

/** POST /api/conversations/:id/messages — { body?, attachment? (data URL) } */
export async function sendConversationMessage(id, { body, attachment } = {}) {
  return apiFetch(`/api/conversations/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ body, attachment })
  });
}

/** POST /api/conversations/:id/read */
export async function markConversationRead(id) {
  return apiFetch(`/api/conversations/${id}/read`, { method: "POST" });
}
