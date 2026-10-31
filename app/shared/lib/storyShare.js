/**
 * The ready story's «بفرست به اینستاگرام» and «ذخیره عکس» inside the frfro Android app, where the
 * WebView can neither share a file nor download one (StorySharePlugin in mobile/). A browser, or an
 * app from before the plugin, gets null and the story maker uses the web way.
 */
function nativeStoryShare() {
  if (typeof window === "undefined") return null;
  const cap = window.Capacitor;
  const has = cap?.isNativePlatform?.()
    && typeof cap.nativePromise === "function"
    && (cap.PluginHeaders || []).some((plugin) => plugin?.name === "StoryShare");
  return has ? cap : null;
}

/** Whether the app can share and save the story itself. */
export function hasNativeStoryShare() {
  return Boolean(nativeStoryShare());
}

function base64Of(dataUrl) {
  return String(dataUrl || "").replace(/^data:[^,]*,/, "");
}

/**
 * Copies the link and opens the phone's share list with the picture.
 * Resolves { copied }; throws when the app could not open the list.
 */
export async function shareStoryNative(dataUrl, link) {
  const cap = nativeStoryShare();
  if (!cap) throw new Error("No app");
  const result = await cap.nativePromise("StoryShare", "share", { data: base64Of(dataUrl), link });
  return { copied: Boolean(result?.copied) };
}

/**
 * Saves the picture to the gallery and copies the link.
 * Resolves { copied }; throws with code "DENIED" when the phone refused to let it save.
 */
export async function saveStoryNative(dataUrl, link) {
  const cap = nativeStoryShare();
  if (!cap) throw new Error("No app");
  const result = await cap.nativePromise("StoryShare", "save", { data: base64Of(dataUrl), link });
  return { copied: Boolean(result?.copied) };
}
