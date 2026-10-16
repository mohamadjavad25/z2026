import { apiJson } from "./client";

/** GET /api/billing → the account's subscription, plans with dates, any payment being checked. */
export const getBilling = () => apiJson("/api/billing");

/**
 * POST /api/billing/checkout { plan, forUserId? } → { paymentId, redirect: { method, url, fields? } }
 * forUserId: a salon paying for an artist on its team.
 */
export const startBillingCheckout = (plan, forUserId = null) =>
  apiJson("/api/billing/checkout", { method: "POST", body: JSON.stringify(forUserId ? { plan, forUserId } : { plan }) });

/** GET /api/billing/payments → { payments } (newest first) */
export const listBillingPayments = () => apiJson("/api/billing/payments");

/** GET /api/billing/payments/:id → { payment } (asks the gateway again while it is pending) */
export const getBillingPayment = (id) => apiJson(`/api/billing/payments/${encodeURIComponent(id)}`);
