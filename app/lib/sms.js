import { getDb, run } from "./db/connection.js";

/**
 * SMS sending, provider-agnostic. Pick one with ZIBABAN_SMS_PROVIDER:
 *   - "kavenegar": real SMS (needs KAVENEGAR_API_KEY and KAVENEGAR_TEMPLATE, a verify-lookup template with %token)
 *   - "test": nothing is sent; the message is kept in sms_log so tests (and the admin panel in a test setup) can read it
 *   - unset: SMS is off -- the app behaves exactly as before and password recovery stays manual.
 * Every attempt is logged (phone masked) so the admin panel can show whether SMS is working.
 */
export function smsProviderName() {
  const name = String(process.env.ZIBABAN_SMS_PROVIDER || "").trim().toLowerCase();
  return name === "kavenegar" || name === "test" ? name : "";
}

export function smsEnabled() {
  return Boolean(smsProviderName());
}

export function maskPhone(phone) {
  const value = String(phone || "");
  return value.length >= 8 ? `${value.slice(0, 4)}***${value.slice(-4)}` : "***";
}

async function sendKavenegar(phone, token) {
  const key = process.env.KAVENEGAR_API_KEY;
  const template = process.env.KAVENEGAR_TEMPLATE;
  if (!key || !template) return { ok: false, detail: "kavenegar not configured" };
  const url = new URL(`https://api.kavenegar.com/v1/${encodeURIComponent(key)}/verify/lookup.json`);
  url.searchParams.set("receptor", phone);
  url.searchParams.set("token", token);
  url.searchParams.set("template", template);
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const payload = await response.json().catch(() => ({}));
  const status = Number(payload?.return?.status);
  return status === 200 ? { ok: true, detail: "" } : { ok: false, detail: String(payload?.return?.message || response.status).slice(0, 120) };
}

/** Sends a short verification token (the code). Returns { ok } and never throws. */
export async function sendVerificationSms(phone, token, purpose) {
  const provider = smsProviderName();
  let result = { ok: false, detail: "sms disabled" };
  try {
    if (provider === "kavenegar") result = await sendKavenegar(phone, token);
    else if (provider === "test") result = { ok: true, detail: "" };
  } catch (error) {
    result = { ok: false, detail: String(error?.message || error).slice(0, 120) };
  }
  try {
    const db = await getDb();
    await run(db, `
      INSERT INTO sms_log (phone_masked, purpose, provider, status, detail, body, phone) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [maskPhone(phone), purpose, provider || "none", result.ok ? "sent" : "failed", result.detail, provider === "test" ? token : "", provider === "test" ? phone : ""]);
  } catch {
    // logging must never break sending
  }
  return result;
}
