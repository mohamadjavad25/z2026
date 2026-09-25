import "./styles.css";
import Script from "next/script";
import PbdqInspector from "./components/PbdqInspector.jsx";

// NEXT_PUBLIC_SITE_URL is the single source of truth for the site's public
// domain (see .env.example at the repo root) — app/sitemap.js and
// app/robots.js read the same variable, with the same placeholder fallback,
// so canonical URLs / sitemap entries / robots.txt can never drift apart.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zibaban.example.com";
const HOME_TITLE = "زیبابان | شبکه اجتماعی زیبایی بانوان";
const HOME_DESCRIPTION = "کشف آرایشگاه، نمونه‌کار واقعی، مشاوره زیبایی و رزرو برای بانوان.";

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
