"use client";

import { useSyncExternalStore } from "react";
import { getBilling } from "../../shared/api/billing";

/**
 * One shared picture of the signed-in salon's or artist's subscription, for the pieces that live far apart in the
 * app: the card in Settings, the reminder bar on the home page and the sheets (BillingHost). Any of them can refresh
 * it or open a sheet; all of them re-render together.
 *
 * sheet: null | { kind: "plans" } | { kind: "result", paymentId } | { kind: "history" }
 */
const INITIAL = { overview: null, loading: false, error: "", sheet: null, loadedAt: 0 };
let state = INITIAL;
const listeners = new Set();

function update(patch) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBilling() {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL);
}

let inflight = null;
export function refreshBilling() {
  inflight ??= (async () => {
    update({ loading: true });
    try {
      const { ok, data, payload } = await getBilling();
      update(ok ? { overview: data, error: "", loading: false, loadedAt: Date.now() } : { error: payload?.error || "وضعیت اشتراک بارگذاری نشد.", loading: false });
    } catch {
      update({ loading: false, error: "اتصال برقرار نشد؛ اینترنت را بررسی کن." });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export const openPlans = () => update({ sheet: { kind: "plans" } });
export const openPaymentResult = (paymentId) => update({ sheet: { kind: "result", paymentId: Number(paymentId) } });
export const openPaymentHistory = () => update({ sheet: { kind: "history" } });
export const closeBillingSheet = () => update({ sheet: null });

/** Sign-out or a different account: forget everything. */
export function resetBilling() {
  state = INITIAL;
  for (const listener of listeners) listener();
}

/* ── the checkout the payer left the app for ──
   Kept in this browser so that, back in the app (in the Android app the bank opens in the phone's own browser),
   the result is shown even though the bank's return page opened somewhere else. */
const PENDING_KEY = "frfro-billing-pending";
const PENDING_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function rememberPendingPayment(paymentId) {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify({ id: Number(paymentId), at: Date.now(), shown: false }));
  } catch {
    // storage blocked: the result still shows when the bank sends the payer back to the site
  }
}

export function readPendingPayment() {
  try {
    const value = JSON.parse(window.localStorage.getItem(PENDING_KEY) || "null");
    if (!value?.id || Date.now() - Number(value.at || 0) > PENDING_MAX_AGE_MS) return null;
    return value;
  } catch {
    return null;
  }
}

export function markPendingShown() {
  const value = readPendingPayment();
  if (!value) return;
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify({ ...value, shown: true }));
  } catch {
    // not essential
  }
}

export function forgetPendingPayment(paymentId) {
  const value = readPendingPayment();
  if (paymentId && value && Number(value.id) !== Number(paymentId)) return;
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // not essential
  }
}

/** Sends the payer to the gateway: a plain page load, or a posted form for the few bank gateways that need one. */
export function goToGateway(redirect) {
  if (redirect?.method === "POST") {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = redirect.url;
    for (const [name, value] of Object.entries(redirect.fields || {})) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    return;
  }
  window.location.assign(redirect.url);
}
