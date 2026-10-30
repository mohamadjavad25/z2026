import { appHasPlugin, inAndroidApp } from "./appUpdate";

/**
 * Android's WebView has no navigator.share, so inside the frfro app every «اشتراک‌گذاری» button fell back to copying the
 * link. Builds with StorySharePlugin.shareText open the phone's share list instead: this gives the page a
 * navigator.share that goes through the app, so the existing share buttons need no change. Older apps keep copying.
 */
export function installAppShare() {
  if (typeof window === "undefined" || !inAndroidApp()) return;
  if (typeof navigator.share === "function" || !appHasPlugin("StoryShare", "shareText")) return;
  const cap = window.Capacitor;
  try {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: ({ title = "", text = "", url = "" } = {}) => {
        const body = [text, url].filter(Boolean).join("\n");
        return cap.nativePromise("StoryShare", "shareText", { text: body, title });
      }
    });
  } catch {
    // navigator could not take it; the buttons keep copying the link
  }
}
