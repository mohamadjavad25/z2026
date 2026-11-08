import { trackRequest } from "./busyTracker";
import { createRequestBreaker } from "./requestBreaker";
import { endActivityVisit, trackAction } from "../lib/activity";
import { learnServerTime } from "../lib/clock.js";

const getBreaker = createRequestBreaker();
const OVERLOADED = new Set([502, 503, 504]);
export const BUSY_MESSAGE = "الان یه کم شلوغه؛ چند لحظه دیگه دوباره بزن.";
export const TIMEOUT_MESSAGE = "جوابی نیومد؛ اینترنتت رو چک کن و دوباره بزن.";
// No request waits forever (HEALTH debt 11, 2026-11-08): a read gets 25 seconds, a save 2 minutes, because a
// photo sent as text on a slow line can take a while. A caller can pass its own `timeoutMs`.
const READ_TIMEOUT_MS = 25 * 1000;
const WRITE_TIMEOUT_MS = 120 * 1000;

/** fetch with a time limit; the caller's own `signal` still cancels it as before (AbortError). */
async function fetchWithTimeout(path, init, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const outer = init.signal;
  const forward = () => controller.abort();
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener("abort", forward, { once: true });
  }
  try {
    return await fetch(path, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      const timeout = new Error(TIMEOUT_MESSAGE);
      timeout.name = "TimeoutError";
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener?.("abort", forward);
  }
}

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
  const { timeoutMs, ...fetchOptions } = options;
  const sentAt = Date.now();
  try {
    response = await trackRequest(fetchWithTimeout(path, {
      headers: { "Content-Type": "application/json", ...(fetchOptions.headers || {}) },
      ...fetchOptions
    }, timeoutMs || (isGet ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS)), options.method);
  } catch (error) {
    if (isGet) getBreaker.record(breakerKey, 0);
    throw error;
  }
  // The server's clock, so «امروز» and every countdown are right even on a phone set to the wrong date. Only answers
  // that were not served from the browser's cache say when "now" is.
  if (!isGet || /no-store|no-cache/i.test(response.headers?.get?.("cache-control") || "")) {
    learnServerTime(response.headers?.get?.("date"), sentAt, Date.now());
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
