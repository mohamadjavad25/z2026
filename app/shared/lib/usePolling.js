"use client";

import { useEffect, useRef } from "react";

/**
 * Run `task` now and then every `intervalMs` -- but only while the tab is
 * visible, never overlapping a run that is still in flight, and with an
 * immediate catch-up when the user comes back to the tab. Hidden tabs used to
 * keep hammering the API every 8s, which is wasted load that scales with users.
 */
export function usePolling(task, intervalMs, enabled = true) {
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    if (!enabled) return undefined;
    let running = false;
    const run = async () => {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      try {
        await taskRef.current();
      } catch {
        // keep current data
      } finally {
        running = false;
      }
    };
    run();
    const timer = window.setInterval(run, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, enabled]);
}
