import { trackRequest } from "./busyTracker";

export async function apiFetch(path, options = {}) {
  const response = await trackRequest(fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  }), options.method);
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload, response };
}

export async function apiJson(path, options = {}) {
  const { ok, status, payload } = await apiFetch(path, options);
  return { ok, status, data: payload.data ?? payload, payload };
}
