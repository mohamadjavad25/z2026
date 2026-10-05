import "./styles.css";
import Script from "next/script";
import PbdqInspector from "./components/PbdqInspector.jsx";
import { ViewportHeightFix } from "./components/ViewportHeightFix.jsx";
import { ClientErrorReporter } from "./components/ClientErrorReporter.jsx";
import { getSiteUrl } from "./lib/siteUrl.js";

// NEXT_PUBLIC_SITE_URL is the single source of truth for the site's public
// domain (see .env.example at the repo root) — app/sitemap.js and
// app/robots.js read the same variable, with the same placeholder fallback,
// so canonical URLs / sitemap entries / robots.txt can never drift apart.
const SITE_URL = getSiteUrl();
const HOME_TITLE = "زیبابان | شبکه اجتماعی زیبایی بانوان";
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
  // The whole UI is hand-designed for a single light palette -- no
  // prefers-color-scheme:dark rules exist anywhere in the app. Without this,
  // a browser/OS that has its own "auto-darken web content" heuristic on
  // (Chrome's "Auto dark theme for web contents" on Android, active by
  // default in many regions whenever the system is in dark mode -- and the
  // same heuristic also fires in desktop Chrome once its theme is set to
  // Auto/Dark) has no signal that this page already has an intentional
  // color scheme, so it force-inverts/recolors it: light, near-transparent
  // fills (e.g. the booking wheel's ~10%-opacity purple focus box) get
  // pushed toward dark, solid ones, while the page's own CSS -- and the
  // DOM's own computed styles -- still read back exactly as authored. This
  // one flag is what tells that heuristic "this page already chose its
  // colors, leave it alone."
  colorScheme: "light"
};

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  // The homepage itself was missing alternates.canonical and openGraph —
  // every /salons, /artists detail page already has both (see their
  // generateMetadata), but the root route had neither, so shared links to
  // zibaban.com itself had no canonical tag and no rich preview card.
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: "/",
    siteName: "زیبابان",
    locale: "fa_IR",
    type: "website"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@500;700;800;900&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1c202c" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="زیبابان" />
      </head>
      <body>
        <PbdqInspector />
        <ViewportHeightFix />
        <ClientErrorReporter />
        {children}
        <Script id="sw-register" strategy="afterInteractive">
          {`if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
}`}
        </Script>
      </body>
    </html>
  );
}
