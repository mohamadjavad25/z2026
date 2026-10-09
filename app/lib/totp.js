import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** RFC 6238 time-based one-time passwords (Google Authenticator, Microsoft Authenticator, Authy, ...). SHA-1, 6 digits, 30 s. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD_SECONDS = 30;

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of String(text || "").toUpperCase().replace(/[\s=-]/g, "")) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("invalid base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function totpCodeAt(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const binary = ((hmac[offset] & 127) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}

export const totpStepAt = (now = Date.now()) => Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);

/**
 * Checks a code against the current step +-1 (clock drift). Returns the matched step, or null.
 * `afterStep` is the last step already used: anything at or before it is refused, so a code (even one
 * shoulder-surfed or intercepted) works exactly once.
 */
export function verifyTotp(secret, code, { now = Date.now(), afterStep = 0 } = {}) {
  const given = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(given)) return null;
  const current = totpStepAt(now);
  let matched = null;
  for (const step of [current - 1, current, current + 1]) {
    const expected = Buffer.from(totpCodeAt(secret, step));
    // Every candidate is compared (no early exit) so timing does not reveal which step matched.
    if (timingSafeEqual(expected, Buffer.from(given)) && step > afterStep && matched === null) matched = step;
  }
  return matched;
}

export function totpUri({ secret, account, issuer = "frfro" }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${TOTP_PERIOD_SECONDS}`;
}
