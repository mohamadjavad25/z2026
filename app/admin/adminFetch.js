import { apiFetch } from "../shared/api/client";

/**
 * apiFetch for admin calls. When the server answers "stepup_required" (a dangerous action needs a fresh password check),
 * the registered dialog asks for the password, and the call is retried once. A dropped connection comes back as a normal
 * failed result (never a thrown error), so every screen can show one message instead of crashing.
 */
let askForPassword = null;
export function registerStepUp(handler) {
  askForPassword = handler;
  return () => {
    if (askForPassword === handler) askForPassword = null;
  };
}

const OFFLINE = { ok: false, status: 0, payload: { error: "اتصال به سرور برقرار نشد. اینترنت را بررسی کن و دوباره امتحان کن." } };

async function call(path, options) {
  try {
    return await apiFetch(path, options);
  } catch {
    return OFFLINE;
  }
}

export async function adminFetch(path, options = {}) {
  let result = await call(path, options);
  if (result.status === 403 && result.payload?.code === "stepup_required" && askForPassword && (await askForPassword())) {
    result = await call(path, options);
  }
  return result;
}

/** Short forms: `api.get(path)`, `api.post(path, body)`, `api.put / patch / del(path, body)`. */
export const api = {
  get: (path) => adminFetch(path),
  post: (path, body = {}) => adminFetch(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body = {}) => adminFetch(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body = {}) => adminFetch(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: (path, body = {}) => adminFetch(path, { method: "DELETE", body: JSON.stringify(body) })
};
