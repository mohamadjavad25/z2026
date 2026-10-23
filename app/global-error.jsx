"use client";

import { useEffect } from "react";
import { reportClientError } from "./shared/lib/reportClientError";

// Only fires when the ROOT layout itself (app/layout.jsx) throws -- Next.js
// requires this to render its own complete <html>/<body>, since the layout
// that would normally provide them is what crashed. Deliberately uses only
// inline styles (no className/external CSS) for the same reason: app/
// styles.css is imported by the layout this is replacing, so it can't be
// relied on here. Colours come from a tiny inline <style> so the page still
// follows the device's day/night setting (the same ink, pink and mist as tokens.css).
const FALLBACK_CSS = `
  :root { --ge-bg: #f3f2f8; --ge-ink: #0c0d12; --ge-muted: #62667a; --ge-btn: #0c0d12; --ge-on-btn: #ffffff; color-scheme: light dark; }
  @media (prefers-color-scheme: dark) { :root { --ge-bg: #0c0d12; --ge-ink: #f7f7fb; --ge-muted: #a0a4b6; --ge-btn: #ff86b8; --ge-on-btn: #0c0d12; } }
`;
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error(error);
    reportClientError(error, "global-error");
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <head>
        <style dangerouslySetInnerHTML={{ __html: FALLBACK_CSS }} />
      </head>
      <body style={{
        margin: 0,
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Tahoma, Arial, sans-serif",
        background: "var(--ge-bg)",
        color: "var(--ge-ink)",
        padding: "24px"
      }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <p style={{ fontSize: "0.85rem", color: "var(--ge-muted)", margin: "0 0 8px" }}>خطا</p>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 12px" }}>یه مشکلی پیش اومد</h1>
          <p style={{ fontSize: "0.9rem", lineHeight: 1.8, margin: "0 0 24px" }}>
            یه چیزی خراب شد که انتظارش رو نداشتیم. صفحه رو دوباره باز کن.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              border: "none",
              borderRadius: 14,
              padding: "12px 24px",
              fontSize: "0.85rem",
              fontWeight: 900,
              fontFamily: "inherit",
              color: "var(--ge-on-btn)",
              background: "var(--ge-btn)",
              cursor: "pointer"
            }}
          >
            تلاش دوباره
          </button>
        </div>
      </body>
    </html>
  );
}
