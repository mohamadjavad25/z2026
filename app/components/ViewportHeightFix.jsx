"use client";

import { useEffect } from "react";

/**
 * Keeps a `--vh` custom property (1% of the actual visible height) in sync
 * with `visualViewport`, which shrinks correctly when the on-screen
 * keyboard opens even on browsers/versions that don't yet honor the
 * `interactive-widget=resizes-content` viewport meta (notably older
 * iOS Safari) or where `100dvh` alone doesn't recompute reliably around
 * the keyboard. CSS then uses `calc(var(--vh, 1vh) * 100)` alongside
 * `100dvh` so keyboard-anchored layouts (the auth gate's forms) reflow
 * with the keyboard and land back exactly where they started once it
 * closes, instead of drifting.
 */
export function ViewportHeightFix() {
  useEffect(() => {
    const target = window.visualViewport;
    function setVh() {
      const height = target?.height || window.innerHeight;
      document.documentElement.style.setProperty("--vh", `${height * 0.01}px`);
    }
    setVh();
    target?.addEventListener("resize", setVh);
    window.addEventListener("resize", setVh);
    return () => {
      target?.removeEventListener("resize", setVh);
      window.removeEventListener("resize", setVh);
    };
  }, []);

  return null;
}
