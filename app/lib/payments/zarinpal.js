/**
 * Zarinpal (زرین‌پال), written against its public v4 REST API. Not yet tried against Zarinpal's own servers (they
 * were unreachable from the build machine): before going live, run one test payment with ZARINPAL_SANDBOX=1 and a
 * sandbox merchant id, then one small real payment. The request/verify shapes are covered by tests/unit/zarinpal.test.js.
 *
 * Settings: FRFRO_PAYMENT_GATEWAY=zarinpal, ZARINPAL_MERCHANT_ID (36 characters), optional ZARINPAL_SANDBOX=1.
 * Amounts are sent in rial (currency IRR).
 *
 * Flow: request.json -> authority -> the payer goes to StartPay/<authority> -> Zarinpal sends them back to our
 * callback with ?Authority=..&Status=OK|NOK -> we call verify.json with the same amount. Code 100 is paid now, 101 is
 * "already verified" (a second verify of a paid one): both mean paid.
 */
const TIMEOUT_MS = 10_000;

const host = () => (process.env.ZARINPAL_SANDBOX === "1" ? "https://sandbox.zarinpal.com" : "https://payment.zarinpal.com");
const merchantId = () => String(process.env.ZARINPAL_MERCHANT_ID || "").trim();

// Answers that mean "this payment did not happen": the payer failed or cancelled (-51), the amount does not match
// (-50), the authority is unknown or expired (-54, -55). Anything else (network, server, our own settings) leaves the
// payment pending so it is asked about again instead of being written off.
const FAILED_CODES = new Map([
  [-50, "مبلغ پرداخت‌شده با مبلغ اشتراک یکی نبود."],
  [-51, "پرداخت انجام نشد یا لغوش کردی."],
  [-54, "این پرداخت در درگاه پیدا نشد."],
  [-55, "این پرداخت در درگاه پیدا نشد."]
]);

async function post(path, body, fetchImpl) {
  const response = await fetchImpl(`${host()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const payload = await response.json().catch(() => ({}));
  const data = payload?.data && !Array.isArray(payload.data) ? payload.data : {};
  const errors = payload?.errors && !Array.isArray(payload.errors) ? payload.errors : {};
  const code = Number(data.code ?? errors.code ?? NaN);
  const message = String(data.message || errors.message || `HTTP ${response.status}`);
  return { httpStatus: response.status, code, message, data };
}

export function createZarinpalGateway({ fetchImpl = (...args) => fetch(...args) } = {}) {
  return {
    id: "zarinpal",
    label: "زرین‌پال",
    isSandbox: false,
    formHosts: [],
    configured: () => merchantId().length >= 30,
    missingConfig: () => (merchantId().length >= 30 ? [] : ["ZARINPAL_MERCHANT_ID"]),

    async request({ payment, callbackUrl, description, mobile }) {
      const result = await post("/pg/v4/payment/request.json", {
        merchant_id: merchantId(),
        amount: Number(payment.amount_rial),
        currency: "IRR",
        callback_url: callbackUrl,
        description: String(description || "").slice(0, 250),
        metadata: { ...(mobile ? { mobile: String(mobile) } : {}), order_id: String(payment.id) }
      }, fetchImpl);
      if (result.code !== 100 || !result.data.authority) return { ok: false, detail: `zarinpal request ${result.code}: ${result.message}` };
      const authority = String(result.data.authority);
      return { ok: true, authority, payload: {}, redirect: { method: "GET", url: `${host()}/pg/StartPay/${encodeURIComponent(authority)}` } };
    },

    parseCallback(params) {
      return { authority: String(params.Authority || ""), cancelled: String(params.Status || "") !== "OK" };
    },

    async verify({ payment }) {
      let result;
      try {
        result = await post("/pg/v4/payment/verify.json", {
          merchant_id: merchantId(),
          amount: Number(payment.amount_rial),
          authority: String(payment.authority)
        }, fetchImpl);
      } catch (error) {
        return { status: "unknown", detail: `zarinpal verify unreachable: ${String(error?.message || error).slice(0, 120)}` };
      }
      if (result.code === 100 || result.code === 101) {
        return {
          status: "paid",
          refId: String(result.data.ref_id ?? ""),
          cardPan: String(result.data.card_pan || ""),
          // Zarinpal checks the amount itself (-50 when it differs), so a paid answer is for exactly this amount.
          amountRial: Number(payment.amount_rial),
          detail: `zarinpal ${result.code}`
        };
      }
      if (FAILED_CODES.has(result.code)) return { status: "failed", failure: FAILED_CODES.get(result.code), detail: `zarinpal ${result.code}: ${result.message}` };
      return { status: "unknown", detail: `zarinpal verify ${Number.isNaN(result.code) ? result.httpStatus : result.code}: ${result.message}` };
    }
  };
}

export const zarinpalGateway = createZarinpalGateway();
