import { getDb, run } from "./db/connection.js";
import { SMS_TEMPLATES, kavenegarSafe } from "./smsTemplates.js";

/**
 * SMS sending, provider-agnostic. Pick one with FRFRO_SMS_PROVIDER:
 *   - "kavenegar": real SMS (needs KAVENEGAR_API_KEY and KAVENEGAR_TEMPLATE, a verify-lookup template with %token)
 *   - "farazsms": real SMS via Faraz SMS (api.iranpayamak.com, the panel at panel.iranpayamak.com; needs FARAZSMS_API_KEY, FARAZSMS_PATTERN_CODE, FARAZSMS_SENDER; the pattern text must use %code%, or set FARAZSMS_PARAM)
 *   - "test": nothing is sent; the message is kept in sms_log so tests (and the admin panel in a test setup) can read it
 *   - unset: SMS is off -- the app behaves exactly as before and password recovery stays manual.
 * Every attempt is logged (phone masked) so the admin panel can show whether SMS is working.
 *
 * Two kinds of message: the verification code (sendVerificationSms) and pattern messages such as the subscription
 * receipt (sendTemplateSms, patterns listed in smsTemplates.js, each switched on by its own env var).
 */
export function smsProviderName() {
  const name = String(process.env.FRFRO_SMS_PROVIDER || "").trim().toLowerCase();
  return name === "kavenegar" || name === "farazsms" || name === "test" ? name : "";
}

export function smsEnabled() {
  return Boolean(smsProviderName());
}

export function maskPhone(phone) {
  const value = String(phone || "");
  return value.length >= 8 ? `${value.slice(0, 4)}***${value.slice(-4)}` : "***";
}

async function sendKavenegarLookup(phone, template, tokens) {
  const key = process.env.KAVENEGAR_API_KEY;
  if (!key || !template) return { ok: false, detail: "kavenegar not configured" };
  const url = new URL(`https://api.kavenegar.com/v1/${encodeURIComponent(key)}/verify/lookup.json`);
  url.searchParams.set("receptor", phone);
  url.searchParams.set("template", template);
  for (const [name, value] of Object.entries(tokens)) url.searchParams.set(name, value);
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const payload = await response.json().catch(() => ({}));
  const status = Number(payload?.return?.status);
  return status === 200 ? { ok: true, detail: "" } : { ok: false, detail: String(payload?.return?.message || response.status).slice(0, 120) };
}

async function sendFarazPattern(phone, pattern, params) {
  const key = process.env.FARAZSMS_API_KEY;
  const sender = process.env.FARAZSMS_SENDER;
  if (!key || !pattern || !sender) return { ok: false, detail: "farazsms not configured" };
  const attributes = Object.fromEntries(Object.entries(params).map(([name, value]) => [name, String(value)]));
  const response = await fetch("https://api.iranpayamak.com/ws/v1/sms/pattern", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "Api-Key": key },
    body: JSON.stringify({
      code: pattern,
      attributes,
      recipient: phone,
      line_number: sender.replace(/^\+?98/, ""),
      number_format: "english",
    }),
    signal: AbortSignal.timeout(8000),
  });
  const payload = await response.json().catch(() => ({}));
  return payload?.status === "success"
    ? { ok: true, detail: "" }
    : { ok: false, detail: String(payload?.message || payload?.messages || response.status).slice(0, 120) };
}

async function logAttempt({ phone, purpose, provider, result, body }) {
  try {
    const db = await getDb();
    await run(db, `
      INSERT INTO sms_log (phone_masked, purpose, provider, status, detail, body, phone) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [maskPhone(phone), purpose, provider || "none", result.ok ? "sent" : "failed", result.detail, provider === "test" ? body : "", provider === "test" ? phone : ""]);
  } catch {
    // logging must never break sending
  }
}

/** Sends a short verification token (the code). Returns { ok } and never throws. */
export async function sendVerificationSms(phone, token, purpose) {
  const provider = smsProviderName();
  let result = { ok: false, detail: "sms disabled" };
  try {
    if (provider === "kavenegar") result = await sendKavenegarLookup(phone, process.env.KAVENEGAR_TEMPLATE, { token });
    else if (provider === "farazsms") {
      // Sign-up and password reset may each have their own pattern (FARAZSMS_PATTERN_CODE_REGISTER / _RESET).
      const pattern = process.env[`FARAZSMS_PATTERN_CODE_${String(purpose || "").toUpperCase()}`] || process.env.FARAZSMS_PATTERN_CODE;
      result = await sendFarazPattern(phone, pattern, { [process.env.FARAZSMS_PARAM || "code"]: token });
    }
    else if (provider === "test") result = { ok: true, detail: "" };
  } catch (error) {
    result = { ok: false, detail: String(error?.message || error).slice(0, 120) };
  }
  await logAttempt({ phone, purpose, provider, result, body: token });
  return result;
}

/** The provider's pattern name/code for one template, or "" when the operator has not set it up. */
function templateId(provider, template) {
  if (provider === "kavenegar") return String(process.env[`KAVENEGAR_TEMPLATE_${template.env}`] || "").trim();
  if (provider === "farazsms") return String(process.env[`FARAZSMS_PATTERN_${template.env}`] || "").trim();
  return provider === "test" ? "test" : "";
}

/** Whether `key` (see smsTemplates.js) would really be sent: a provider is on and its pattern is set. */
export function templateConfigured(key) {
  const template = SMS_TEMPLATES[key];
  return Boolean(template && templateId(smsProviderName(), template));
}

/**
 * Sends one pattern message. When SMS or this pattern is not set up it does nothing and logs nothing (that is the
 * normal state until the operator connects SMS). Returns { ok, skipped? } and never throws.
 */
export async function sendTemplateSms(phone, key, values, purpose = key) {
  const template = SMS_TEMPLATES[key];
  const provider = smsProviderName();
  const id = template ? templateId(provider, template) : "";
  if (!template || !id || !phone) return { ok: false, skipped: true, detail: "template not configured" };
  let result;
  try {
    if (provider === "kavenegar") result = await sendKavenegarLookup(phone, id, kavenegarSafe(template.kavenegar(values)));
    else if (provider === "farazsms") result = await sendFarazPattern(phone, id, template.faraz(values));
    else result = { ok: true, detail: "" };
  } catch (error) {
    result = { ok: false, detail: String(error?.message || error).slice(0, 120) };
  }
  await logAttempt({ phone, purpose, provider, result, body: template.preview(values) });
  return result;
}
