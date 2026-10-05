import { useEffect, useState } from "react";
import { apiFetch } from "../../shared/api/client";

/** SMS-code availability, fetched once: { enabled, required, resendSeconds }. Until it loads, everything behaves as "off". */
export function useOtpConfig() {
  const [config, setConfig] = useState({ enabled: false, required: false, resendSeconds: 60 });
  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/auth/otp/config").then(({ ok, payload }) => {
      if (!cancelled && ok && payload.data) setConfig(payload.data);
    });
    return () => { cancelled = true; };
  }, []);
  return config;
}

/** Counts down from `seconds` once started; `restart()` begins it again. */
export function useCountdown(seconds) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return undefined;
    const timer = setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return { left, restart: () => setLeft(seconds) };
}

export const sendCode = (phone, purpose) => apiFetch("/api/auth/otp/send", { method: "POST", body: JSON.stringify({ phone, purpose }) });
export const verifyCode = (phone, code) => apiFetch("/api/auth/otp/verify", { method: "POST", body: JSON.stringify({ phone, code }) });
export const confirmReset = (body) => apiFetch("/api/auth/password-reset/confirm", { method: "POST", body: JSON.stringify(body) });
