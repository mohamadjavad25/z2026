import { afterHistorySettles } from "./backStack";

/**
 * Carrying a salon or artist from their public page (`/salons/12`, `/artists/34`, the page a QR or a
 * shared link opens) into the app, so the visitor lands on that same place instead of an empty home.
 *
 * The public page sends the visitor to `/?open=salon-12`. The app (useHomeApp) keeps the target in
 * localStorage until a session exists, so a sign-up or login in between does not lose it; then a client
 * is connected to the place and its services menu opens.
 *
 * The root layout's head script also reads `?open=` / `?join=` to skip the about page on phones
 * (LargeScreenGate): someone who came to book or to join a team should not land on the about page.
 */

export const PENDING_OPEN_KEY = "frfro_pending_open";

const OPEN_PARAM = /^(salon|artist)-(\d+)$/;

/** `/?open=salon-12` for a salon or artist id. */
export function openInAppHref(type, id) {
  return `/?open=${type === "artist" ? "artist" : "salon"}-${Number(id)}`;
}

/** `{ type, id }` for an `open` param value, else null. */
export function parseOpenParam(value) {
  const match = String(value || "").trim().match(OPEN_PARAM);
  if (!match) return null;
  const id = Number(match[2]);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return { type: match[1], id };
}

const MAX_PENDING_SERVICES = 6;

/** The service names a guest picked on a public salon page, cleaned for storing (a few short strings). */
export function cleanPendingServices(names) {
  return (Array.isArray(names) ? names : [])
    .map((name) => String(name || "").trim())
    .filter((name) => name && name.length <= 120)
    .slice(0, MAX_PENDING_SERVICES);
}

/** The names of the service(s) in what a services menu hands over (one service, or a bundle of several). */
export function pickedServiceNames(picked) {
  if (!picked) return [];
  if (Array.isArray(picked.items) && picked.items.length) return cleanPendingServices(picked.items.map((item) => item?.name));
  return cleanPendingServices([picked.name]);
}

/** `services`: what the guest had ticked, so after signing up the booking form opens on it (features/follow/useContinueService). */
export function rememberPendingOpen(target) {
  if (!target?.id) return;
  try {
    window.localStorage.setItem(PENDING_OPEN_KEY, JSON.stringify({ type: target.type, id: target.id, name: target.name || "", services: cleanPendingServices(target.services) }));
  } catch {
    // private mode: the visitor just lands on the app's home
  }
}

/** The pending place without removing it (e.g. to name it on the sign-up screen), or null. */
export function peekPendingOpen() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PENDING_OPEN_KEY) || "null");
    const target = parseOpenParam(`${parsed?.type}-${parsed?.id}`);
    return target ? { ...target, name: String(parsed?.name || ""), services: cleanPendingServices(parsed?.services) } : null;
  } catch {
    return null;
  }
}

/** The pending place, removed so it opens only once, or null. */
export function takePendingOpen() {
  const target = peekPendingOpen();
  try {
    window.localStorage.removeItem(PENDING_OPEN_KEY);
  } catch {
    // nothing to clean up
  }
  return target;
}

/**
 * From a public page: remember the place and go to the app. A client-side navigation does not re-run the
 * head script, so the about-page skip is set here too. The tap usually also closes the services sheet,
 * whose back-button entry is popped right after; navigating before that pop would be undone by it.
 */
export function goToAppFor(router, target) {
  rememberPendingOpen(target);
  if (typeof document !== "undefined") document.documentElement.classList.add("skip-landing");
  // Remembered like a tap on «ورود به فرفرو»: coming back to "/" later (browser Back) must open the app, not the about page.
  try { window.localStorage.setItem("frfro-entered", "1"); } catch { /* private mode */ }
  afterHistorySettles(() => router.push(openInAppHref(target.type, target.id)));
}
