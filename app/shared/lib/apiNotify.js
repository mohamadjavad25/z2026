/**
 * Shared API → user-facing Persian notify helpers.
 * Matches wallet / booking convention: prefer payload.error, then payload.message.
 */

/** Extract a user-facing error string from an API JSON body. */
export function getApiErrorMessage(payload, fallback = "عملیات انجام نشد.") {
  const error = payload?.error;
  if (typeof error === "string" && error.trim()) return error.trim();
  const message = payload?.message;
  if (typeof message === "string" && message.trim()) return message.trim();
  return fallback;
}

/**
 * Notify from an `apiFetch`-style `{ ok, payload }` result.
 * On failure: shows error (never a success string) and returns false — callers must not
 * update local state or show success when this returns false.
 * On success: optionally shows `success`, returns true.
 *
 * @param {(msg: string) => void} notify
 * @param {{ ok?: boolean, payload?: object } | null | undefined} result
 * @param {{ success?: string | ((payload: object) => string), failure?: string }} [options]
 * @returns {boolean}
 */
export function notifyFromResponse(notify, result, options = {}) {
  const { success, failure = "عملیات انجام نشد." } = options;
  const ok = Boolean(result?.ok);
  const payload = result?.payload ?? {};
  if (!ok) {
    if (typeof notify === "function") {
      notify(getApiErrorMessage(payload, failure));
    }
    return false;
  }
  if (typeof notify === "function" && success != null) {
    notify(typeof success === "function" ? success(payload) : success);
  }
  return true;
}
