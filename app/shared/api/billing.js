import { apiJson } from "./client";

/** GET /api/billing → the account's subscription, plans with dates, any payment being checked. */
export const getBilling = () => apiJson("/api/billing");

/** POST /api/billing/checkout { plan } → { paymentId, redirect: { method, url, fields? } } */
export const startBillingCheckout = (plan) => apiJson("/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan }) });

/** GET /api/billing/payments → { payments } (newest first) */
export const listBillingPayments = () => apiJson("/api/billing/payments");

/** GET /api/billing/payments/:id → { payment } (asks the gateway again while it is pending) */
export const getBillingPayment = (id) => apiJson(`/api/billing/payments/${encodeURIComponent(id)}`);
