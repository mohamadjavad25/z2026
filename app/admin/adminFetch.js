import { apiFetch } from "../shared/api/client";

/**
 * apiFetch for admin calls. When the server answers "stepup_required" (a dangerous action needs a fresh password check),
 * the registered dialog asks for the password, and the call is retried once.
 */
let askForPassword = null;
export function registerStepUp(handler) {
  askForPassword = handler;
  return () => {
    if (askForPassword === handler) askForPassword = null;
  };
}

export async function adminFetch(path, options = {}) {
  let result = await apiFetch(path, options);
  if (result.status === 403 && result.payload?.code === "stepup_required" && askForPassword && (await askForPassword())) {
    result = await apiFetch(path, options);
  }
  return result;
}
