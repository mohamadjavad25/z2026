"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ENTER_APP_EVENT, LARGE_SCREEN_QUERY } from "./constants";

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

// Set before first paint by the root layout's head script (app, home-screen icon, or the
// visitor already tapped «ورود به فرفرو»).
function skipsHomeLanding() {
  return document.documentElement.classList.contains("skip-landing");
}

/**
 * Wraps every page (root layout). On a large screen the page itself is not mounted at
 * all, only the about page. The home page ("/") shows the about page on phones too, until
 * the visitor taps «ورود به فرفرو» (EnterAppButton). Inside the Android/iOS app the page is
 * always shown. CSS does the first paint (no flash); this only stops the hidden page from running.
 */
export function LargeScreenGate({ landing, children }) {
  const pathname = usePathname() || "/";
  const [large, setLarge] = useState(false);
  const [homeLanding, setHomeLanding] = useState(false);
  const gated = !isAlwaysShown(pathname);
  const isHome = pathname === "/";

  useEffect(() => {
    if (!gated || isNativeApp()) return undefined;
    const query = window.matchMedia(LARGE_SCREEN_QUERY);
    const update = () => setLarge(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [gated]);

  useEffect(() => {
    if (!isHome) return undefined;
    setHomeLanding(!skipsHomeLanding());
    const enter = () => setHomeLanding(false);
    window.addEventListener(ENTER_APP_EVENT, enter);
    return () => window.removeEventListener(ENTER_APP_EVENT, enter);
  }, [isHome]);

  if (!gated) return children;
  return (
    <>
      <div className={isHome ? "landingSlot is-home" : "landingSlot"}>{landing}</div>
      <div className="pageSlot">{large || (isHome && homeLanding) ? null : children}</div>
    </>
  );
}
