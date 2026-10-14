"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LARGE_SCREEN_QUERY } from "./constants";

// Pages that look the same on every screen. Everything else is a phone page: on a
// tablet or desktop the about/download page is shown instead (landing.css).
// /terms and /privacy stay readable because the about page links to them.
const ALWAYS_SHOWN = ["/admin", "/download", "/terms", "/privacy"];

function isAlwaysShown(pathname) {
  return ALWAYS_SHOWN.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isNativeApp() {
  return typeof navigator !== "undefined" && navigator.userAgent.includes("frfro-app");
}

/**
 * Wraps every page (root layout). On a large screen the page itself is not mounted at
 * all, only the about page. Inside the Android/iOS app the page is always shown.
 * CSS does the first paint (no flash); this only stops the hidden page from running.
 */
export function LargeScreenGate({ landing, children }) {
  const pathname = usePathname() || "/";
  const [large, setLarge] = useState(false);
  const gated = !isAlwaysShown(pathname);

  useEffect(() => {
    if (!gated || isNativeApp()) return undefined;
    const query = window.matchMedia(LARGE_SCREEN_QUERY);
    const update = () => setLarge(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [gated]);

  if (!gated) return children;
  return (
    <>
      <div className="landingSlot">{landing}</div>
      <div className="pageSlot">{large ? null : children}</div>
    </>
  );
}
