"use client";

/**
 * Shown while auth session is checked (replaces blank opacity:0 boot).
 */
export function AuthBootScreen() {
  return (
    <div className="authBootScreen" role="status" aria-live="polite" aria-label="در حال آماده‌سازی زیبابان">
      <div className="authBootInner">
        <img className="authBootLogo" src="/logo-mark.png" alt="" aria-hidden="true" draggable={false} />
        <p className="authBootBrand">زیبابان</p>
        <span className="authBootSpinner" aria-hidden="true" />
        <small>در حال آماده‌سازی…</small>
      </div>
    </div>
  );
}
