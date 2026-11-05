import { trackRequest } from "./busyTracker";
import { createRequestBreaker } from "./requestBreaker";
import { endActivityVisit, trackAction } from "../lib/activity";

const getBreaker = createRequestBreaker();
const OVERLOADED = new Set([502, 503, 504]);
export const BUSY_MESSAGE = "الان یه کم شلوغه؛ چند لحظه دیگه دوباره بزن.";

// The footprint's main actions: only the fact that it worked is noted, never what was sent. (Artist services share
// /api/artist/me with other things, so shared/api/artists.js notes those itself.)
const ACTIONS = {
  "POST /api/auth/register": "register",
  "POST /api/auth/login": "login",
  "POST /api/posts": "add_post",
  "POST /api/salon-portfolio": "add_post",
  "POST /api/salon-services": "add_service",
  "PATCH /api/artist-hours": "save_hours",
  "PATCH /api/salon-hours": "save_hours",
  "PATCH /api/profile": "edit_profile",
  "POST /api/artist/bookings": "book_sent",
  "POST /api/salon-bookings": "book_sent"
};

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
  else if (response.ok) {
    const action = ACTIONS[`${String(options.method).toUpperCase()} ${String(path).split("?")[0]}`];
    if (action === "register" || action === "login") endActivityVisit();
    if (action) trackAction(action);
  }
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
