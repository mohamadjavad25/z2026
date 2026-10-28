import { apiJson } from "./client";

/** GET /api/billing → the account's subscription, plans with dates, any payment being checked. */
export const getBilling = () => apiJson("/api/billing");

/**
 * POST /api/billing/checkout { plan, forUserId? } → { paymentId, redirect: { method, url, fields? } }
 * forUserId: a salon paying for an artist on its team.
 */
export const startBillingCheckout = (plan, forUserId = null) =>
  apiJson("/api/billing/checkout", { method: "POST", body: JSON.stringify(forUserId ? { plan, forUserId } : { plan }) });

/** POST /api/billing/checkout { pack } → { paymentId, redirect }: an SMS pack for the signed-in account's own wallet. */
export const startSmsPackCheckout = (pack) =>
  apiJson("/api/billing/checkout", { method: "POST", body: JSON.stringify({ pack }) });

/** GET /api/billing/payments → { payments } (newest first) */
export const listBillingPayments = () => apiJson("/api/billing/payments");

/** GET /api/billing/payments/:id → { payment } (asks the gateway again while it is pending) */
export const getBillingPayment = (id) => apiJson(`/api/billing/payments/${encodeURIComponent(id)}`);
