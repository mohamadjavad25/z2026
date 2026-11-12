import { apiFetch, apiJson } from "./client";

/** GET /api/connections → { connections } (the client's salons and artists) */
export async function listConnections({ withServices = false } = {}) {
  return apiJson(withServices ? "/api/connections?services=1" : "/api/connections");
}

/** GET /api/connections/search?q= → { by: "link" | "phone" | "name" | "none", results } */
export async function searchConnections(query, { signal } = {}) {
  return apiJson(`/api/connections/search?q=${encodeURIComponent(query)}`, { signal });
}

/** GET /api/connections/by-category?category= → { category, matches } (my salons/artists that do it, with the matching services) */
export async function listConnectionsForCategory(category) {
  return apiJson(`/api/connections/by-category?category=${encodeURIComponent(category)}`);
}

/** POST /api/connections { targetUserId } → { profile, alreadyConnected } */
export async function connectTo(targetUserId) {
  return apiFetch("/api/connections", { method: "POST", body: JSON.stringify({ targetUserId }) });
}

/** GET /api/connections/code → { code } (the client's personal QR content) */
export async function getMyConnectCode() {
  return apiJson("/api/connections/code");
}

/** POST /api/connections/scan { code } (salon/artist) → { client, alreadyConnected } */
export async function connectScannedClient(code) {
  return apiFetch("/api/connections/scan", { method: "POST", body: JSON.stringify({ code }) });
}

/** GET /api/connections/lookup?code= (any role) → { profile, relation } for a scanned salon/artist code */
export async function lookupScannedCode(code) {
  return apiJson(`/api/connections/lookup?code=${encodeURIComponent(code)}`);
}


/** GET /api/connections/by-service?service= (or ?name= for a service not on the list) → { matches } */
export async function listConnectionsForService({ id = "", name = "" }) {
  const query = id ? `service=${encodeURIComponent(id)}` : `name=${encodeURIComponent(name)}`;
  return apiJson(`/api/connections/by-service?${query}`);
}
