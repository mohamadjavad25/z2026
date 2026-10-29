/**
 * Puts a ready story picture where Instagram can pick it up:
 * - the frfro Android app: its own StorySaver plugin (mobile/) writes it into the gallery, since the WebView
 *   ignores download links; an app from before that plugin has to be updated first;
 * - iPhone: the share list, whose «Save Image» puts it in Photos (a download would land in Files);
 * - other browsers: a normal download (Chrome on Android shows it in the gallery's Download album).
 *
 * Returns "gallery" | "shared" | "downloaded" | "cancelled" | "update-app" | "old-android" | "failed".
 */
function nativeApp() {
  if (typeof window === "undefined") return null;
  const cap = window.Capacitor;
  return cap?.isNativePlatform?.() ? cap : null;
}

function nativeStorySaver() {
  const cap = nativeApp();
  const has = cap
    && typeof cap.nativePromise === "function"
    && (cap.PluginHeaders || []).some((plugin) => plugin?.name === "StorySaver");
  return has ? cap : null;
}

function isIphone() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent || "")
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export async function saveStoryImage({ dataUrl, file, name = "frfro-story" }) {
  if (!dataUrl) return "failed";
  const cap = nativeStorySaver();
  if (cap) {
    try {
      await cap.nativePromise("StorySaver", "save", { data: dataUrl.split(",")[1] || "", name });
      return "gallery";
    } catch (error) {
      return error?.code === "OLD_ANDROID" ? "old-android" : "failed";
    }
  }
  if (nativeApp()) return "update-app";
  if (file && isIphone() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (error) {
      return error?.name === "AbortError" ? "cancelled" : "failed";
    }
  }
  try {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${name}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return "downloaded";
  } catch {
    return "failed";
  }
}

/** Copies text, with the old textarea way for WebViews that refuse the clipboard API. Resolves true/false. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
