import "./styles.css";
import Script from "next/script";

export const metadata = {
  title: "زیبابان | شبکه اجتماعی زیبایی بانوان",
  description: "کشف آرایشگاه، نمونه‌کار واقعی، مشاوره زیبایی و رزرو برای بانوان."
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
