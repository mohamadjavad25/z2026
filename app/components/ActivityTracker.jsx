"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { startActivity, trackScreen } from "../shared/lib/activity";

/** A site address as a footprint name: public pages carry whose page it is; «/» is the app, which names its own tabs. */
function screenOf(pathname) {
  const [first, second] = String(pathname || "/").split("/").filter(Boolean);
  if (!first || first === "admin") return null;
  if (first === "artists") return { name: "public_artist", profile: Number(second) };
  if (first === "salons") return { name: "public_salon", profile: Number(second) };
  return { name: `page:${first.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) || "other"}` };
}

/** Mounts once in the root layout: starts the footprint (app/shared/lib/activity.js) and notes each address. */
export function ActivityTracker() {
  const pathname = usePathname();
  useEffect(() => {
    startActivity();
  }, []);
  useEffect(() => {
    const screen = screenOf(pathname);
    if (screen) trackScreen(screen.name, screen.profile);
  }, [pathname]);
  return null;
}
