/**
 * Notifications inside the frfro Android app. The site's Web Push does not exist in the app's WebView, so
 * here the app's own push (@capacitor/push-notifications + Firebase) gets a device token and the site saves
 * it (POST /api/push/native). While that token is fresh, booking and subscription news reach this person as a
 * push only, with no SMS (app/lib/push.js: reachableByAppPush).
 *
 * Talks to the native side the same way contactPicker.js does (Capacitor.nativePromise / nativeCallback), so
 * the site needs no Capacitor package. FrfroPush (mobile/: FrfroPushPlugin.java) says whether this build has
 * Firebase at all: registering without it would crash the app. An app from before this has neither plugin,
 * and simply keeps getting the SMS.
 */

const TOKEN_KEY = "frfro-app-push-token";
let listening = false;

function nativeApp() {
  if (typeof window === "undefined") return null;
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.() || typeof cap.nativePromise !== "function") return null;
  return cap;
}

function hasPlugin(cap, name) {
  return (cap.PluginHeaders || []).some((plugin) => plugin?.name === name);
}

function storedToken() {
  try { return window.localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}

function storeToken(token) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch { /* private storage off: the server copy still works */ }
}

function sendToken(method, token) {
  return fetch("/api/push/native", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, platform: window.Capacitor?.getPlatform?.() || "android" })
  }).catch(() => null);
}

/** Only paths on this site: a notification never sends the app somewhere else. */
function openPath(url) {
  const path = String(url || "/");
  if (!path.startsWith("/") || path.startsWith("//")) return;
  if (window.location.pathname + window.location.search !== path) window.location.assign(path);
}

function listen(cap) {
  if (listening || typeof cap.nativeCallback !== "function") return;
  listening = true;
  cap.nativeCallback("PushNotifications", "addListener", { eventName: "registration" }, (event) => {
    const token = event?.value || "";
    if (!token) return;
    storeToken(token);
    void sendToken("POST", token);
  });
  // Tapped in the phone's notification list: open the screen it is about.
  cap.nativeCallback("PushNotifications", "addListener", { eventName: "pushNotificationActionPerformed" }, (event) => {
    openPath(event?.notification?.data?.url);
  });
}

/** Inside the frfro app with push built in (from this version on). */
export function appPushAvailable() {
  const cap = nativeApp();
  return Boolean(cap && hasPlugin(cap, "PushNotifications") && hasPlugin(cap, "FrfroPush"));
}

/**
 * After every login and app start. Asks once for the notification permission (Android 13+ shows the system
 * question), then registers and saves the token. When the permission is off, the saved token is dropped so the
 * server goes back to sending the SMS. One that arrives while the app is open still shows in the phone's list
 * (capacitor.config.json: PushNotifications.presentationOptions).
 */
export async function startAppPush() {
  const cap = nativeApp();
  if (!cap || !appPushAvailable()) return false;
  try {
    const status = await cap.nativePromise("FrfroPush", "status", {});
    if (!status?.ready) return false;
    let permission = (await cap.nativePromise("PushNotifications", "checkPermissions", {}))?.receive;
    if (permission === "prompt" || permission === "prompt-with-rationale") {
      permission = (await cap.nativePromise("PushNotifications", "requestPermissions", {}))?.receive;
    }
    if (permission !== "granted") {
      const old = storedToken();
      if (old) { storeToken(""); await sendToken("DELETE", old); }
      return false;
    }
    listen(cap);
    await cap.nativePromise("PushNotifications", "register", {});
    return true;
  } catch {
    return false;
  }
}

/** Before logout: this phone stops getting the account's notifications. */
export async function stopAppPush() {
  const token = storedToken();
  if (!token || !nativeApp()) return;
  storeToken("");
  await sendToken("DELETE", token);
}
