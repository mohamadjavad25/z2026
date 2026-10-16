import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createZarinpalGateway } from "../../app/lib/payments/zarinpal.js";

const MERCHANT = "00000000-0000-0000-0000-000000000000";
const payment = { id: 42, amount_rial: 25_000_000, authority: "A000000000000000000000000000000001" };

function fakeFetch(answer) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    if (answer instanceof Error) throw answer;
    return { status: answer.status || 200, json: async () => answer.body };
  };
  return { calls, fetchImpl };
}

describe("Zarinpal gateway (v4 API, mocked)", () => {
  beforeEach(() => {
    process.env.ZARINPAL_MERCHANT_ID = MERCHANT;
    delete process.env.ZARINPAL_SANDBOX;
  });
  afterEach(() => {
    delete process.env.ZARINPAL_MERCHANT_ID;
    delete process.env.ZARINPAL_SANDBOX;
  });

  it("needs a merchant id", () => {
    delete process.env.ZARINPAL_MERCHANT_ID;
    const gateway = createZarinpalGateway();
    expect(gateway.configured()).toBe(false);
    expect(gateway.missingConfig()).toEqual(["ZARINPAL_MERCHANT_ID"]);
  });

  it("starts a payment in rial and sends the payer to StartPay", async () => {
    const { calls, fetchImpl } = fakeFetch({ body: { data: { code: 100, authority: "A0001" }, errors: [] } });
    const result = await createZarinpalGateway({ fetchImpl }).request({ payment, callbackUrl: "https://frfro.ir/api/billing/callback/zarinpal?pid=42", description: "اشتراک", mobile: "09120000000" });
    expect(calls[0].url).toBe("https://payment.zarinpal.com/pg/v4/payment/request.json");
    expect(calls[0].body).toMatchObject({ merchant_id: MERCHANT, amount: 25_000_000, currency: "IRR", metadata: { mobile: "09120000000", order_id: "42" } });
    expect(result).toEqual({ ok: true, authority: "A0001", payload: {}, redirect: { method: "GET", url: "https://payment.zarinpal.com/pg/StartPay/A0001" } });
  });

  it("uses the sandbox host when asked", async () => {
    process.env.ZARINPAL_SANDBOX = "1";
    const { calls, fetchImpl } = fakeFetch({ body: { data: { code: 100, authority: "S1" } } });
    const result = await createZarinpalGateway({ fetchImpl }).request({ payment, callbackUrl: "x" });
    expect(calls[0].url.startsWith("https://sandbox.zarinpal.com/")).toBe(true);
    expect(result.redirect.url).toBe("https://sandbox.zarinpal.com/pg/StartPay/S1");
  });

  it("reports a refused start", async () => {
    const { fetchImpl } = fakeFetch({ status: 401, body: { data: [], errors: { code: -10, message: "terminal not valid" } } });
    const result = await createZarinpalGateway({ fetchImpl }).request({ payment, callbackUrl: "x" });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("-10");
  });

  it("reads the callback", () => {
    const gateway = createZarinpalGateway();
    expect(gateway.parseCallback({ Authority: "A1", Status: "OK" })).toEqual({ authority: "A1", cancelled: false });
    expect(gateway.parseCallback({ Authority: "A1", Status: "NOK" })).toEqual({ authority: "A1", cancelled: true });
  });

  it("treats 100 and 101 as paid, with the same amount sent", async () => {
    for (const code of [100, 101]) {
      const { calls, fetchImpl } = fakeFetch({ body: { data: { code, ref_id: 201, card_pan: "502229******5995" } } });
      const result = await createZarinpalGateway({ fetchImpl }).verify({ payment });
      expect(calls[0].body).toEqual({ merchant_id: MERCHANT, amount: 25_000_000, authority: payment.authority });
      expect(result).toMatchObject({ status: "paid", refId: "201", cardPan: "502229******5995", amountRial: 25_000_000 });
    }
  });

  it("writes off only definite failures, and keeps asking otherwise", async () => {
    const failed = await createZarinpalGateway(fakeFetch({ body: { data: [], errors: { code: -51, message: "failed" } } })).verify({ payment });
    expect(failed.status).toBe("failed");
    const mismatch = await createZarinpalGateway(fakeFetch({ body: { errors: { code: -50, message: "amount" } } })).verify({ payment });
    expect(mismatch.status).toBe("failed");
    const busy = await createZarinpalGateway(fakeFetch({ status: 503, body: {} })).verify({ payment });
    expect(busy.status).toBe("unknown");
    const throttled = await createZarinpalGateway(fakeFetch({ body: { errors: { code: -12, message: "too many" } } })).verify({ payment });
    expect(throttled.status).toBe("unknown");
    const offline = await createZarinpalGateway(fakeFetch(new Error("ECONNRESET"))).verify({ payment });
    expect(offline.status).toBe("unknown");
  });
});
