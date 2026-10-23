"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { Spinner } from "./Spinner";
import { refreshApp } from "../shared/lib/appRefresh";
import { hasOpenOverlay } from "../shared/lib/backStack";

// Pull distance (after damping) that triggers a refresh, and the most the indicator travels.
const TRIGGER = 72;
const MAX_PULL = 110;
// The spinner stays at least this long so a fast refresh still reads as "done".
const MIN_SPIN_MS = 600;
// A slow network never leaves the spinner up; the loaders keep going and apply when they land.
const MAX_SPIN_MS = 8000;

// Gestures that start here belong to something else (typing, maps, pickers, drawing).
const IGNORE_SELECTOR = "input, textarea, select, [contenteditable='true'], .leaflet-container, canvas, [data-no-pull-refresh]";

function isAppMode() {
  return document.documentElement.classList.contains("native-app")
    || window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
}

// Is every scroll container between the finger and the page scrolled to the very top?
function atTop(target) {
  if ((window.scrollY || document.documentElement.scrollTop) > 0) return false;
  for (let el = target; el && el !== document.body; el = el.parentElement) {
    if (el.scrollTop > 0) return false;
  }
  return true;
}

/**
 * Pull down from the top of the page to refresh what is on screen. Only in the
 * Android/iOS app and in the home-screen web app (a normal browser has its own).
 * The page is not reloaded: every data hook re-fetches (appRefresh) and server
 * pages re-render (router.refresh), so the user stays on the same tab, sheet and
 * step. Data normally stays fresh on its own (usePolling); this is the manual fallback.
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const gesture = useRef(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!isAppMode()) return undefined;

    const onStart = (event) => {
      gesture.current = null;
      if (refreshingRef.current || event.touches.length !== 1 || hasOpenOverlay() || document.querySelector("[aria-modal='true']")) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest(IGNORE_SELECTOR) || !atTop(target)) return;
      const touch = event.touches[0];
      gesture.current = { x: touch.clientX, y: touch.clientY, active: false };
    };

    const onMove = (event) => {
      const g = gesture.current;
      if (!g) return;
      const touch = event.touches[0];
      const dy = touch.clientY - g.y;
      const dx = Math.abs(touch.clientX - g.x);
      if (!g.active) {
        if (dy < 8 && dx < 8) return;
        // Only a clear downward pull; sideways swipes and upward scrolls are left alone.
        if (dy <= 0 || dx > dy) {
          gesture.current = null;
          return;
        }
        g.active = true;
      }
      pullRef.current = Math.min(MAX_PULL, Math.max(0, dy) * 0.5);
      setPull(pullRef.current);
    };

    const onEnd = () => {
      const g = gesture.current;
      gesture.current = null;
      if (!g?.active) return;
      const triggered = pullRef.current >= TRIGGER;
      pullRef.current = 0;
      if (!triggered) {
        setPull(0);
        return;
      }
      setPull(TRIGGER);
      setRefreshing(true);
      refreshingRef.current = true;
      routerRef.current.refresh();
      const minSpin = new Promise((resolve) => window.setTimeout(resolve, MIN_SPIN_MS));
      const maxSpin = new Promise((resolve) => window.setTimeout(resolve, MAX_SPIN_MS));
      Promise.race([Promise.all([refreshApp(), minSpin]), maxSpin]).finally(() => {
        refreshingRef.current = false;
        setRefreshing(false);
        setPull(0);
      });
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  if (!pull && !refreshing) return null;
  const ready = pull >= TRIGGER;
  return (
    <div
      className={`pullRefresh${ready ? " is-ready" : ""}${refreshing ? " is-refreshing" : ""}`}
      style={{ transform: `translate(-50%, ${pull}px)` }}
      role="status"
      aria-label={refreshing ? "دارم تازه می‌کنم" : ready ? "ولش کن تا تازه بشه" : "بکش تا تازه بشه"}
    >
      {refreshing ? <Spinner size={22} /> : <RotateCw size={20} style={{ transform: `rotate(${pull * 3}deg)` }} aria-hidden="true" />}
    </div>
  );
}
