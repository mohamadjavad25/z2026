import { sandboxGateway } from "./sandbox.js";
import { zarinpalGateway } from "./zarinpal.js";

/**
 * Payment gateways. Exactly one is active, chosen with FRFRO_PAYMENT_GATEWAY ("sandbox", "zarinpal", ...). With it
 * unset, or set to a gateway whose keys are missing, nobody can check out, and billing is never enforced (an account is
 * never closed for not paying while paying is impossible).
 *
 * ── Adding another gateway (IDPay, NextPay, Zibal, a bank PSP, ...) ─────────────────────────────────────────────
 * Write one file next to this one that exports an object with this shape, and add it to GATEWAYS below:
 *
 *   id            short name used in FRFRO_PAYMENT_GATEWAY and in the callback address (/api/billing/callback/<id>)
 *   label         Persian name shown in the admin panel
 *   isSandbox     false
 *   formHosts     [] for gateways that redirect with a GET (most do). A gateway that needs a POST form to the bank
 *                 lists the bank's origin here AND in FRFRO_PAYMENT_FORM_HOSTS (next.config.mjs adds it to the CSP).
 *   configured()  true when its keys are set
 *   missingConfig()  names of the env vars still missing (the admin panel lists them)
 *   request({ payment, callbackUrl, description, mobile, origin })
 *                 asks the gateway to start a payment of payment.amount_rial (RIAL). Returns
 *                 { ok: true, authority, redirect: { method: "GET" | "POST", url, fields? }, payload? }
 *                 or { ok: false, detail }. `authority` is the gateway's token for this payment; `payload` is stored on
 *                 the payment row (gateway_payload) for anything verify() needs later.
 *   parseCallback(params)  the gateway's return parameters (query string and posted form merged) -> { authority, cancelled }
 *   verify({ payment })   asks the gateway whether payment (with .authority, .amount_rial, .gateway_payload) was paid:
 *                 { status: "paid", refId, cardPan?, amountRial }    money received (amountRial = what the gateway says)
 *                 { status: "failed", failure, detail? }              definitely not paid (failure is Persian, shown to the user)
 *                 { status: "unknown", detail }                      could not tell (network, gateway down): asked again later
 *
 * Never trust the callback's own "OK": the payment is marked paid only from verify().
 */
const GATEWAYS = {
  [sandboxGateway.id]: sandboxGateway,
  [zarinpalGateway.id]: zarinpalGateway
};

export const selectedGatewayId = () => String(process.env.FRFRO_PAYMENT_GATEWAY || "").trim().toLowerCase();

/** The gateway new checkouts go to, or null when none is usable. */
export function activeGateway() {
  const gateway = GATEWAYS[selectedGatewayId()];
  return gateway && gateway.configured() ? gateway : null;
}

/** Any known gateway by id, active or not: a payment is always verified with the gateway it was made with. */
export function gatewayById(id) {
  return GATEWAYS[String(id || "")] || null;
}

export function gatewayLabel(id) {
  if (!id) return "ثبت مدیر";
  return GATEWAYS[id]?.label || id;
}

/** For the admin panel: which gateway is selected and whether it can take payments (names of missing keys only, never values). */
export function gatewayStatus() {
  const selected = selectedGatewayId();
  const gateway = GATEWAYS[selected];
  return {
    selected,
    known: Boolean(gateway),
    label: gateway?.label || "",
    ready: Boolean(gateway?.configured()),
    sandbox: Boolean(gateway?.isSandbox),
    missing: gateway ? gateway.missingConfig() : selected ? [] : ["FRFRO_PAYMENT_GATEWAY"],
    available: Object.values(GATEWAYS).map((item) => ({ id: item.id, label: item.label }))
  };
}
