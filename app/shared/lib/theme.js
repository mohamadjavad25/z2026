// Day / night preference and the role accent.
//
// Preference: "auto" (follow the device), "light" or "dark", kept per device in localStorage.
// <html data-theme="light|dark"> forces one; with neither attribute the CSS follows the OS
// (see the colour system at the top of styles/tokens.css). The same logic runs once before first
// paint from the inline script in layout.jsx (THEME_BOOT_SCRIPT), so there is no flash.
//
// Role: <html data-role="client|pro"> chooses the accent (pink for clients, violet for salons and
// artists). The last known role is remembered so the very first paint already has it.

export const THEME_KEY = "frfro-theme";
export const ROLE_KEY = "frfro-role";
const CHANGE_EVENT = "frfro:theme-pref";
const BAR_COLORS = { light: "#f3f2f8", dark: "#0c0d12" };

export function getThemePreference() {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "auto";
  } catch {
    return "auto";
  }
}

function systemPrefersDark() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/** The theme actually showing right now: "light" or "dark". */
export function resolvedTheme(preference = getThemePreference()) {
  if (preference === "light" || preference === "dark") return preference;
  return systemPrefersDark() ? "dark" : "light";
}

/** Paints the preference onto <html> and the browser bar colour. Safe to call any time. */
export function applyTheme(preference = getThemePreference()) {
  const root = document.documentElement;
  if (preference === "light" || preference === "dark") root.setAttribute("data-theme", preference);
  else root.removeAttribute("data-theme");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", BAR_COLORS[resolvedTheme(preference)]);
}

export function setThemePreference(preference) {
  const next = preference === "light" || preference === "dark" ? preference : "auto";
  try {
    if (next === "auto") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, next);
  } catch {
    // the choice just doesn't persist
  }
  applyTheme(next);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeThemePreference(callback) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  let media = null;
  try {
    media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", callback);
  } catch {
    // old webview: no live OS updates
  }
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
    media?.removeEventListener("change", callback);
  };
}

/** "client" for clients and signed-out visitors, "pro" for salons and artists. */
export function applyRole(profileType) {
  const role = profileType === "salon" || profileType === "artist" ? "pro" : "client";
  document.documentElement.setAttribute("data-role", role);
  try {
    window.localStorage.setItem(ROLE_KEY, role);
  } catch {
    // remembered role is only a first-paint nicety
  }
}

/** Runs in <head> before first paint (inlined by layout.jsx). Keep it tiny and dependency-free. */
export const THEME_BOOT_SCRIPT = `(function () {
  var root = document.documentElement;
  var pref = "auto", role = "client";
  try {
    var t = localStorage.getItem("${THEME_KEY}");
    if (t === "light" || t === "dark") pref = t;
    if (localStorage.getItem("${ROLE_KEY}") === "pro") role = "pro";
  } catch (e) {}
  if (pref !== "auto") root.setAttribute("data-theme", pref);
  root.setAttribute("data-role", role);
  var dark = pref === "dark" || (pref === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "${BAR_COLORS.dark}" : "${BAR_COLORS.light}");
})();`;
