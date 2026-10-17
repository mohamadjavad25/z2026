import { randomBytes } from "node:crypto";

/**
 * The test gateway: a pretend bank page inside the site (/pay/sandbox/<token>) with «پرداخت موفق» and «انصراف».
 * No money moves. On only when FRFRO_PAYMENT_GATEWAY=sandbox, and every payment it makes is marked as a test in the
 * app and the admin panel and left out of revenue. It goes through the exact same checkout -> callback -> verify ->
 * settle path a real gateway does, so the whole system can be tried before a real gateway is connected.
 *
 * What the pretend bank page answered is kept on the payment row (gateway_payload.sandboxResult); verify() reads it
 * from there, never from the callback, just as a real gateway is asked over its own API.
 */
export const sandboxGateway = {
  id: "sandbox",
  label: "درگاه آزمایشی",
  isSandbox: true,
  formHosts: [],
  configured: () => true,
  missingConfig: () => [],

  async request({ callbackUrl, origin }) {
    const authority = `SBX${randomBytes(12).toString("hex").toUpperCase()}`;
    return {
      ok: true,
      authority,
      payload: { callbackUrl },
      redirect: { method: "GET", url: `${origin}/pay/sandbox/${authority}` }
    };
  },

  parseCallback(params) {
    return { authority: String(params.Authority || ""), cancelled: String(params.Status || "") !== "OK" };
  },

  async verify({ payment }) {
    const payload = payment.gateway_payload || {};
    const amountRial = Number(payment.amount_rial);
    if (payload.sandboxResult === "paid") {
      return { status: "paid", refId: payload.sandboxRef, cardPan: "6037-99**-****-4242", amountRial, detail: "sandbox: paid" };
    }
    if (payload.sandboxResult === "paid-wrong-amount") {
      return { status: "paid", refId: payload.sandboxRef, cardPan: "6037-99**-****-4242", amountRial: amountRial - 10_000, detail: "sandbox: wrong amount" };
    }
    if (payload.sandboxResult === "cancelled") return { status: "failed", failure: "پرداخت را لغو کردی.", detail: "sandbox: cancelled" };
    return { status: "unknown", detail: "sandbox: no answer yet" };
  }
};

/** What the pretend bank page records when a button is pressed. A tracking code like a bank's (digits only). */
export function sandboxAnswer(action) {
  const ref = String(10_000_000 + (randomBytes(4).readUInt32BE(0) % 89_999_999));
  if (action === "pay") return { sandboxResult: "paid", sandboxRef: ref };
  if (action === "pay-wrong-amount") return { sandboxResult: "paid-wrong-amount", sandboxRef: ref };
  return { sandboxResult: "cancelled" };
}
