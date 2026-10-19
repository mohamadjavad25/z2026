import { createSign } from "node:crypto";

/**
 * Firebase Cloud Messaging (HTTP v1) for the frfro Android app. Configured by one env var,
 * FRFRO_FCM_SERVICE_ACCOUNT: the Firebase service-account key file (JSON), base64-encoded so it fits
 * on one line of /etc/frfro/env. Unset means off: no app push is sent, and since the app then never
 * counts as reachable (push.js), everyone keeps getting the SMS. Setup: docs/OPERATIONS.md («اعلان اپ اندروید»).
 *
 * The app shows these on the "frfro" channel it creates itself (FrfroPushPlugin.java): high
 * importance, so a new booking request sounds and pops up like a message.
 */

const CHANNEL_ID = "frfro";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

let account;
function serviceAccount() {
  if (account !== undefined) return account;
  account = null;
  const raw = String(process.env.FRFRO_FCM_SERVICE_ACCOUNT || "").trim();
  if (!raw) return account;
  try {
    const parsed = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
    if (parsed.project_id && parsed.client_email && parsed.private_key) account = parsed;
  } catch {
    console.error("FRFRO_FCM_SERVICE_ACCOUNT is not a valid service-account key; app push is off.");
  }
  return account;
}

export const fcmConfigured = () => Boolean(serviceAccount());

const base64url = (value) => Buffer.from(value).toString("base64url");

let cached = { token: "", expiresAt: 0 };
async function accessToken() {
  if (cached.token && Date.now() < cached.expiresAt) return cached.token;
  const sa = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify({
    iss: sa.client_email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600
  }))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
    signal: AbortSignal.timeout(8000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error(`FCM auth failed (${response.status})`);
  cached = { token: payload.access_token, expiresAt: Date.now() + (Number(payload.expires_in || 3600) - 120) * 1000 };
  return cached.token;
}

/**
 * Sends one notification to one app. Returns { ok } or { ok: false, gone } — gone means the token no
 * longer belongs to an installed app and should be deleted.
 */
export async function sendFcm(token, { title, body, url = "/" }) {
  if (!fcmConfigured()) return { ok: false, gone: false };
  const sa = serviceAccount();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await accessToken()}` },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: String(title || "فرفرو"), body: String(body || "") },
        data: { url: String(url || "/") },
        android: {
          priority: "HIGH",
          ttl: "86400s",
          notification: { channel_id: CHANNEL_ID, sound: "default", default_vibrate_timings: true, notification_priority: "PRIORITY_HIGH" }
        }
      }
    }),
    signal: AbortSignal.timeout(8000)
  });
  if (response.ok) return { ok: true };
  const payload = await response.json().catch(() => ({}));
  const codes = JSON.stringify(payload?.error?.details || []) + String(payload?.error?.status || "");
  const gone = response.status === 404 || codes.includes("UNREGISTERED")
    || (response.status === 400 && codes.includes("INVALID_ARGUMENT") && /token/i.test(String(payload?.error?.message || "")));
  if (response.status === 401) cached = { token: "", expiresAt: 0 };
  return { ok: false, gone };
}
