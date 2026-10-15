"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getThemePreference, setThemePreference, subscribeThemePreference } from "./theme";

/** [preference, setPreference]: "auto" | "light" | "dark", per device. */
export function useThemePreference() {
  const preference = useSyncExternalStore(subscribeThemePreference, getThemePreference, () => "auto");
  const set = useCallback((value) => setThemePreference(value), []);
  return [preference, set];
}
