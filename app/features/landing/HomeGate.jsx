"use client";

import { useEffect, useState } from "react";
import { HomeApp } from "../shell";
import { LARGE_SCREEN_QUERY } from "./constants";

function isNativeApp() {
  return typeof navigator !== "undefined" && navigator.userAgent.includes("frfro-app");
}

/**
 * The phone app at /. On a large screen (tablet, desktop) the about/download page is
 * shown instead (CSS hides this slot, see landing.css) and the app is not mounted at
 * all. Inside the Android/iOS app the app is always shown.
 */
export function HomeGate() {
  const [large, setLarge] = useState(false);

  useEffect(() => {
    if (isNativeApp()) return undefined;
    const query = window.matchMedia(LARGE_SCREEN_QUERY);
    const update = () => setLarge(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return <div className="homeAppSlot">{large ? null : <HomeApp />}</div>;
}
