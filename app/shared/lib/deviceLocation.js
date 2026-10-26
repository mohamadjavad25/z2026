/**
 * Whether the phone's location is switched on, before the map starts looking for it. Only the
 * frfro Android app can tell (DeviceLocationPlugin in mobile/); a browser, or an app from before
 * the plugin, answers null and the map just tries.
 */
function nativeDeviceLocation() {
  if (typeof window === "undefined") return null;
  const cap = window.Capacitor;
  const has = cap?.isNativePlatform?.()
    && typeof cap.nativePromise === "function"
    && (cap.PluginHeaders || []).some((plugin) => plugin?.name === "DeviceLocation");
  return has ? cap : null;
}

/** true / false inside the app, null where it cannot be told. */
export async function deviceLocationEnabled() {
  const cap = nativeDeviceLocation();
  if (!cap) return null;
  try {
    const result = await cap.nativePromise("DeviceLocation", "status");
    return Boolean(result?.enabled);
  } catch {
    return null;
  }
}

/** Opens the phone's location settings; false where that cannot be done. */
export async function openDeviceLocationSettings() {
  const cap = nativeDeviceLocation();
  if (!cap) return false;
  try {
    await cap.nativePromise("DeviceLocation", "openSettings");
    return true;
  } catch {
    return false;
  }
}

/** Whether the site has been refused the location (browser or app permission). */
export async function locationPermissionDenied() {
  try {
    const status = await navigator.permissions?.query?.({ name: "geolocation" });
    return status?.state === "denied";
  } catch {
    return false;
  }
}
