import { trackRequest } from "./busyTracker";
import { createRequestBreaker } from "./requestBreaker";

const getBreaker = createRequestBreaker();
const OVERLOADED = new Set([502, 503, 504]);
export const BUSY_MESSAGE = "الان یه کم شلوغه؛ چند لحظه دیگه دوباره بزن.";

export async function apiFetch(path, options = {}) {
  const isGet = !options.method || String(options.method).toUpperCase() === "GET";
  // Only the path counts, not the query string, so a loop that varies a parameter is still caught.
  const breakerKey = isGet ? String(path).split("?")[0] : "";
  if (isGet && getBreaker.isBlocked(breakerKey)) {
    // Too many quick failures from this endpoint: don't send another request until the cooldown ends.
    return { ok: false, status: 429, payload: { error: "یه کم زیادی شد؛ چند لحظه دیگه دوباره بزن." }, response: null };
  }
  let response;
  try {
    response = await trackRequest(fetch(path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    }), options.method);
  } catch (error) {
    if (isGet) getBreaker.record(breakerKey, 0);
    throw error;
  }
  if (isGet) getBreaker.record(breakerKey, response.status);
  const payload = await response.json().catch(() => ({}));
  // 502/503/504 come from nginx when the app is overloaded or restarting, with an HTML page and no
  // error text: every screen that shows payload.error then says what to do instead of a blank failure.
  if (OVERLOADED.has(response.status) && !payload.error) payload.error = BUSY_MESSAGE;
  return { ok: response.ok, status: response.status, payload, response };
}

export async function apiJson(path, options = {}) {
  const { ok, status, payload } = await apiFetch(path, options);
  return { ok, status, data: payload.data ?? payload, payload };
}
