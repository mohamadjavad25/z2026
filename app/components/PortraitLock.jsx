"use client";

import { useEffect } from "react";

/**
 * The app is a portrait app. Where the browser allows it (installed app, full screen) the
 * screen is locked to portrait; the manifest and the Android/iOS shells do the same.
 * In a normal browser tab no page can lock the screen, so on a phone turned sideways
 * the page shows a short "turn your phone" card instead (portrait-lock.css).
 */
export function PortraitLock() {
  useEffect(() => {
    try {
      const lock = window.screen?.orientation?.lock;
      if (lock) window.screen.orientation.lock("portrait").catch(() => {});
    } catch {}
  }, []);

  return (
    <div className="portraitLock" role="alert">
      <p>گوشی رو عمودی بگیر</p>
    </div>
  );
}
