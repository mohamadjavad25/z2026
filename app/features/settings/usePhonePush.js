"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../shared/api/client";
import { appPushAvailable } from "../../shared/lib/nativePush";
import { pushNotificationsSupported, subscribeToPushNotifications } from "../shell/homeAppHelpers";

/**
 * Whether this phone or browser gets frfro's notifications while the app is closed.
 * status: "checking" | "unsupported" | "off" (asked never or said no once) | "blocked" (the browser will not ask again) | "on".
 */
export function usePhonePush() {
  const [status, setStatus] = useState("checking");
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    if (appPushAvailable()) return setStatus("on");
    if (!pushNotificationsSupported()) return setStatus("unsupported");
    if (Notification.permission === "denied") return setStatus("blocked");
    if (Notification.permission !== "granted") return setStatus("off");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager?.getSubscription();
      setStatus(subscription ? "on" : "off");
    } catch {
      setStatus("off");
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const turnOn = useCallback(async () => {
    setBusy(true);
    await subscribeToPushNotifications();
    await check();
    setBusy(false);
  }, [check]);

  /** Sends one real notification to this person's own phones; resolves to how many devices took it, or null when it failed. */
  const sendTest = useCallback(async () => {
    setBusy(true);
    const { ok, payload } = await apiFetch("/api/push/test", { method: "POST" }).catch(() => ({ ok: false }));
    setBusy(false);
    return ok ? Number(payload?.data?.sent || 0) : null;
  }, []);

  return { status, busy, turnOn, sendTest };
}
