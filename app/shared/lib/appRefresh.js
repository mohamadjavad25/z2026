"use client";

import { useEffect, useRef } from "react";

/**
 * "Refresh what is on screen" without reloading the page (pull-to-refresh). Data hooks
 * register a loader here; refreshApp() runs them all and resolves when they are done,
 * so the user stays on the same tab, sheet and step with fresh data.
 */
const loaders = new Set();

export function onAppRefresh(loader) {
  loaders.add(loader);
  return () => loaders.delete(loader);
}

export function refreshApp() {
  return Promise.allSettled([...loaders].map((loader) => Promise.resolve().then(loader)));
}

/** Registers `loader` while `enabled`; always calls the latest `loader`. */
export function useAppRefresh(loader, enabled = true) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  useEffect(() => {
    if (!enabled) return undefined;
    return onAppRefresh(() => loaderRef.current());
  }, [enabled]);
}
