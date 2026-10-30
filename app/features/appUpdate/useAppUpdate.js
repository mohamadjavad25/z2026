"use client";

import { useSyncExternalStore } from "react";
import { appInfo, inAndroidApp, updateState } from "../../shared/lib/appUpdate";

/**
 * Whether a newer build of the Android app is on Cafe Bazaar (and whether the admin panel made it a must).
 * Worked out once per page and shared by every caller; outside the app it stays "nothing to update".
 */
const NONE = { ready: true, available: false, forced: false };
let state = { ready: false, available: false, forced: false };
let started = false;
const listeners = new Set();

function set(next) {
  state = next;
  listeners.forEach((listener) => listener());
}

function start() {
  if (started) return;
  started = true;
  if (!inAndroidApp()) {
    set(NONE);
    return;
  }
  Promise.all([
    appInfo(),
    fetch("/api/notice").then((response) => (response.ok ? response.json() : null)).catch(() => null)
  ]).then(([info, payload]) => {
    set({ ready: true, ...updateState(info, payload?.data?.app) });
  }).catch(() => set(NONE));
}

function subscribe(listener) {
  listeners.add(listener);
  start();
  return () => listeners.delete(listener);
}

const SERVER = { ready: false, available: false, forced: false };

export function useAppUpdate() {
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}
