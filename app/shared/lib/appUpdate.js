/**
 * The frfro Android app is a frame around this site: the site changes the moment we deploy, the app only when people
 * update it from Cafe Bazaar. A button that needs something only a newer app can do (a plugin in mobile/) must never
 * pretend it worked in an older app; it asks for the update instead (AppUpdateHost).
 *
 * The app's version name stays 1.0.0 (owner's rule), so the build number (Android versionCode) tells builds apart.
 * Every build ever shipped has @capacitor/app, so even old apps can tell their build number.
 */

export const APP_PACKAGE = "ir.frfro.app";
export const BAZAAR_PAGE = `https://cafebazaar.ir/app/${APP_PACKAGE}`;
const BAZAAR_APP = `bazaar://details?id=${APP_PACKAGE}`;
const ASK_EVENT = "frfro:app-update";

function nativeApp() {
  if (typeof window === "undefined") return null;
  const cap = window.Capacitor;
  return cap?.isNativePlatform?.() && typeof cap.nativePromise === "function" ? cap : null;
}

/** Inside the frfro Android app (the user app or the private admin app). */
export function inAndroidApp() {
  const cap = nativeApp();
  return Boolean(cap) && cap.getPlatform?.() === "android";
}

/** Whether this app build has a plugin (and, if named, one of its methods). Always false outside the app. */
export function appHasPlugin(name, method = "") {
  const cap = nativeApp();
  if (!cap) return false;
  const plugin = (cap.PluginHeaders || []).find((entry) => entry?.name === name);
  if (!plugin) return false;
  return !method || (plugin.methods || []).some((entry) => entry?.name === method);
}

/**
 * True when the person is in the Android app and the app is too old for a feature that needs `plugin`.
 * In a browser (or on iPhone) the site has its own way, so this is false there.
 */
export function appTooOldFor(plugin, method = "") {
  return inAndroidApp() && !appHasPlugin(plugin, method);
}

let infoPromise = null;

/** { id, build } of the running app, or null outside the Android app or when it cannot tell. Asked once per page. */
export function appInfo() {
  if (!inAndroidApp() || !appHasPlugin("App", "getInfo")) return Promise.resolve(null);
  if (!infoPromise) {
    infoPromise = nativeApp().nativePromise("App", "getInfo", {})
      .then((info) => {
        const build = Number(info?.build);
        return { id: String(info?.id || ""), build: Number.isFinite(build) ? build : null };
      })
      .catch(() => null);
  }
  return infoPromise;
}

/**
 * What to ask of the person, from the running build and the admin panel's «اپ اندروید» setting.
 * `latestBuild` is the newest build live on Cafe Bazaar; `forceUpdate` makes older builds stop at the update screen.
 * Only the store app counts: the private admin app is never in a store.
 */
export function updateState(info, setting) {
  const latest = Number(setting?.latestBuild) || 0;
  const storeApp = info?.id === APP_PACKAGE;
  const available = storeApp && info.build != null && latest > info.build;
  return { available, forced: available && Boolean(setting?.forceUpdate) };
}

/**
 * Opens frfro's page in the Cafe Bazaar app, straight at its update button. Without the Bazaar app nothing opens,
 * so if the page is still in front a moment later, the Bazaar website opens instead (in the phone's browser).
 */
export function openStorePage() {
  if (typeof window === "undefined") return;
  let left = false;
  const onHide = () => { if (document.hidden) left = true; };
  document.addEventListener("visibilitychange", onHide);
  window.location.href = BAZAAR_APP;
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    if (!left && !document.hidden) window.location.href = BAZAAR_PAGE;
  }, 1500);
}

/** Opens the update sheet (AppUpdateHost) from any button. `reason` is shown under the title when given. */
export function askForAppUpdate(reason = "") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: { reason } }));
}

export function onAppUpdateAsked(listener) {
  const handle = (event) => listener(event.detail || {});
  window.addEventListener(ASK_EVENT, handle);
  return () => window.removeEventListener(ASK_EVENT, handle);
}
