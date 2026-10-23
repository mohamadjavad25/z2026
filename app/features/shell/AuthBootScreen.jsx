"use client";

import { useEffect, useState } from "react";

// After this long the boot screen says the network is slow instead of spinning in silence.
const SLOW_MS = 8000;

/**
 * Shown while the auth session is checked (cold open only). The mascot peeks up from the
 * bottom like the app icon; the background follows the theme.
 */
export function AuthBootScreen() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="authBootScreen" role="status" aria-live="polite" aria-label="در حال آماده‌سازی frfro">
      <div className="authBootInner">
        <span className="authBootPeek" aria-hidden="true">
          <img src="/brand/frfro-peek.webp" alt="" width="112" height="112" draggable={false} decoding="async" />
        </span>
        <small className={slow ? "authBootSlow" : undefined}>{slow ? "اینترنتت کنده؛ هنوز داریم تلاش می‌کنیم…" : "یه لحظه…"}</small>
      </div>
    </div>
  );
}
