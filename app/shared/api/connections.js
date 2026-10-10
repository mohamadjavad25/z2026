import { apiFetch, apiJson } from "./client";

/** GET /api/connections → { connections } (the client's salons and artists) */
export async function listConnections() {
  return apiJson("/api/connections");
}

/** GET /api/connections/search?q= → { by: "link" | "phone" | "name" | "none", results } */
export async function searchConnections(query, { signal } = {}) {
  return apiJson(`/api/connections/search?q=${encodeURIComponent(query)}`, { signal });
}

/** POST /api/connections { targetUserId } → { profile, alreadyConnected } */
export async function connectTo(targetUserId) {
  return apiFetch("/api/connections", { method: "POST", body: JSON.stringify({ targetUserId }) });
}

/** DELETE /api/connections { targetUserId } → { removed } */
export async function disconnectFrom(targetUserId) {
  return apiFetch("/api/connections", { method: "DELETE", body: JSON.stringify({ targetUserId }) });
}

/** GET /api/connections/code → { code } (the client's personal QR content) */
export async function getMyConnectCode() {
  return apiJson("/api/connections/code");
}

/** POST /api/connections/scan { code } (salon/artist) → { client, alreadyConnected } */
export async function connectScannedClient(code) {
  return apiFetch("/api/connections/scan", { method: "POST", body: JSON.stringify({ code }) });
}
