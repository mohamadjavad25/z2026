import "./styles.css";
import Script from "next/script";
import PbdqInspector from "./components/PbdqInspector.jsx";
import { ViewportHeightFix } from "./components/ViewportHeightFix.jsx";
import { ClientErrorReporter } from "./components/ClientErrorReporter.jsx";
import { PullToRefresh } from "./components/PullToRefresh.jsx";
import { getSiteUrl } from "./lib/siteUrl.js";
import { THEME_BOOT_SCRIPT } from "./shared/lib/theme.js";
import { AppLanding } from "./features/landing/AppLanding";
import { LargeScreenGate } from "./features/landing/LargeScreenGate";

// NEXT_PUBLIC_SITE_URL is the single source of truth for the site's public
// domain (see .env.example at the repo root) — app/sitemap.js and
// app/robots.js read the same variable, with the same placeholder fallback,
// so canonical URLs / sitemap entries / robots.txt can never drift apart.
const SITE_URL = getSiteUrl();
const HOME_TITLE = "frfro | شبکه اجتماعی زیبایی بانوان";
const HOME_DESCRIPTION = "کشف آرایشگاه، نمونه‌کار واقعی، مشاوره زیبایی و رزرو برای بانوان.";

// interactiveWidget: "resizes-content" tells the browser to resize the
// actual layout viewport (not just the visual one) when the on-screen
// keyboard opens/closes. Without it (the Next.js/browser default is
// "resizes-visual" on Chrome/Android), 100dvh-based layouts don't reflow
// when the keyboard appears -- content can end up shifted or covered, and
// never quite lands back in the same spot once the keyboard closes. This
// is exactly the auth-gate form drift reported: fields anchored to the
// bottom of a dvh-tall column need the browser to actually recompute that
// height around the keyboard, not just the visible viewport shrinking
// underneath a layout that hasn't moved.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  // The UI ships its own day and night palettes (styles/tokens.css, switched by
  // shared/lib/theme.js). Declaring both schemes is what tells a browser's
  // "auto-darken web content" heuristic (Chrome's "Auto dark theme for web
  // contents" on Android, and the same heuristic in desktop Chrome with an
  // Auto/Dark theme) that this page already chose its colours, so it must not
  // force-invert them: that used to push light, near-transparent fills (e.g. the
  // booking wheel's ~10%-opacity purple focus box) toward dark, solid ones. The
  // actual scheme in use is set per theme by `color-scheme` in tokens.css.
  colorScheme: "light dark"
};

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  // The homepage itself was missing alternates.canonical and openGraph —
  // every /salons, /artists detail page already has both (see their
  // generateMetadata), but the root route had neither, so shared links to
  // frfro.com itself had no canonical tag and no rich preview card.
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: "/",
    siteName: "frfro",
    locale: "fa_IR",
    type: "website"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Before first paint: the saved day/night choice and the role accent (shared/lib/theme.js), so nothing flashes. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        {/* Before first paint: inside the Android/iOS app (mobile/) the user agent ends with
            "frfro-app". CSS uses the class to always show the app there and hide download links.
            "skip-landing": the home page opens the app, not the about page (HOME_LANDING_SKIP_KEY
            in features/landing/constants.js): in the app, from the home-screen icon, or once the
            visitor tapped «ورود به فرفرو» on the about page. */}
        <script dangerouslySetInnerHTML={{ __html: `(function () {
var root = document.documentElement;
if (navigator.userAgent.indexOf("frfro-app") !== -1) root.classList.add("native-app", "skip-landing");
try {
  if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone || localStorage.getItem("frfro-entered") === "1") root.classList.add("skip-landing");
} catch (e) {}
})();` }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@500;700;800;900&family=Lalezar&family=Playfair+Display:wght@500;600&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#f3f2f8" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="frfro" />
      </head>
      <body>
        <PbdqInspector />
        <ViewportHeightFix />
        <ClientErrorReporter />
        <PullToRefresh />
        <LargeScreenGate landing={<AppLanding />}>{children}</LargeScreenGate>
        <Script id="sw-register" strategy="afterInteractive">
          {`if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
}`}
        </Script>
        {/* Inside the Android/iOS app: a tapped frfro.ir link opens the app, so show that
            page here. Capacitor injects window.Capacitor; on the web this does nothing. */}
        <Script id="native-app" strategy="afterInteractive">
          {`(function () {
var cap = window.Capacitor;
if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
  cap.addListener("App", "appUrlOpen", function (event) {
    try {
      var url = new URL(event.url);
      if (url.hostname === "frfro.ir" || url.hostname.endsWith(".frfro.ir")) {
        location.href = url.pathname + url.search + url.hash;
      }
    } catch (e) {}
  });
}
})();`}
        </Script>
      </body>
    </html>
  );
}
