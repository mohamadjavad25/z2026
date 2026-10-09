"use client";

import { useEffect } from "react";
import { reportClientError } from "./shared/lib/reportClientError";

// Only fires when the ROOT layout itself (app/layout.jsx) throws -- Next.js
// requires this to render its own complete <html>/<body>, since the layout
// that would normally provide them is what crashed. Deliberately uses only
// inline styles (no className/external CSS) for the same reason: app/
// styles.css is imported by the layout this is replacing, so it can't be
// relied on here.
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error(error);
    reportClientError(error, "global-error");
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <body style={{
        margin: 0,
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Tahoma, Arial, sans-serif",
        background: "#d8d9df",
        color: "#1c202c",
        padding: "24px"
      }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <p style={{ fontSize: "0.85rem", color: "#6b6f7a", margin: "0 0 8px" }}>خطا</p>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 12px" }}>یه مشکلی پیش اومد</h1>
          <p style={{ fontSize: "0.9rem", lineHeight: 1.8, margin: "0 0 24px" }}>
            Farfaroo با یه خطای غیرمنتظره مواجه شد. لطفاً صفحه رو دوباره بارگذاری کن.
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
              color: "#fff",
              background: "#14161d",
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
