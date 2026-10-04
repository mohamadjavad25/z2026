"use client";

import { useCallback, useSyncExternalStore } from "react";
import { isSoundEnabled, setSoundEnabled, subscribeSoundPreference } from "./sounds";

/** [enabled, setEnabled] for the per-device "app sounds" switch. */
export function useSoundPreference() {
  const enabled = useSyncExternalStore(subscribeSoundPreference, isSoundEnabled, () => true);
  const set = useCallback((value) => setSoundEnabled(Boolean(value)), []);
  return [enabled, set];
}
