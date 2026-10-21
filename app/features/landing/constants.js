/**
 * Off while the Android app waits for its store release (user's decision 2026-10-21: the APK on
 * the site is not right). While off: no download links anywhere, the auth screens say «به‌زودی»
 * instead, phones go straight to the app at "/" (no about page first), and /download on a phone
 * opens the app. The about page still shows on tablets and desktops. Turn on to bring it all back.
 */
export const APP_DOWNLOADS_OPEN = false;

/** Where the Android app is downloaded from. The APK is built from mobile/ (see mobile/README.md). */
export const ANDROID_APK_URL = "/download/frfro.apk";
export const ANDROID_APP_VERSION = "1.0.0";
export const DOWNLOAD_PAGE_URL = "https://frfro.ir/download";

/** Screens at least this big (tablet and desktop) see the about/download page instead of the phone pages (LargeScreenGate). */
export const LARGE_SCREEN_QUERY = "(min-width: 600px) and (min-height: 600px)";

/**
 * localStorage key (value "1") set when a phone visitor taps «ورود به فرفرو» on the about page.
 * From then on "/" opens the app instead of the about page. The root layout's head script reads
 * the same literal before first paint (keep both in step).
 */
export const HOME_LANDING_SKIP_KEY = "frfro-entered";
/** Event the enter button sends so LargeScreenGate mounts the home page without a reload. */
export const ENTER_APP_EVENT = "frfro:enter-app";
