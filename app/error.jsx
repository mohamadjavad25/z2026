"use client";

import { useEffect } from "react";
import { reportClientError } from "./shared/lib/reportClientError";

// Catches a render/runtime error anywhere under the root layout (so
// app/layout.jsx's <html>/<body>/CSS still apply here) and shows a
// branded fallback instead of Next.js's default error screen. Logging
// client-side only -- there's no server-side error-tracking service wired
// up yet (see the pre-launch readiness notes in docs/DEVLOG.md); this at
// least leaves a trace in the browser console for now.
export default function ErrorBoundary({ error, reset }) {
  useEffect(() => {
    console.error(error);
    reportClientError(error, "error-boundary");
  }, [error]);

  return (
    <main className="errorPage">
      <div className="errorPage__inner">
        <p className="errorPage__code">خطا</p>
        <h1 className="errorPage__title">یه مشکلی پیش اومد</h1>
        <p className="errorPage__desc">این صفحه با خطا مواجه شد. می‌تونی دوباره امتحان کنی یا برگردی به صفحه‌ی اصلی.</p>
        <div className="errorPage__actions">
          <button type="button" className="errorPage__retry" onClick={reset}>تلاش دوباره</button>
          <a href="/" className="errorPage__back">بازگشت به Frfru</a>
        </div>
      </div>
    </main>
  );
}
