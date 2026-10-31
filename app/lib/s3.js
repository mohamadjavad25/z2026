import { createHash, createHmac } from "node:crypto";

/**
 * The few S3 calls the picture store needs (put, delete), signed with AWS Signature V4 by hand so no SDK is added.
 * Works with any S3-compatible object storage; on the main server that is Arvan Cloud's (owner's decision
 * 2026-10-29), configured by:
 *   FRFRO_S3_ENDPOINT    e.g. https://s3.ir-thr-at1.arvanstorage.ir
 *   FRFRO_S3_BUCKET      the bucket name (made public-read in Arvan's panel)
 *   FRFRO_S3_ACCESS_KEY / FRFRO_S3_SECRET_KEY
 *   FRFRO_S3_REGION      optional, default "us-east-1" (Arvan accepts any)
 *   FRFRO_S3_PUBLIC_URL  optional public base for reads, default <endpoint>/<bucket>
 * Path-style addresses (<endpoint>/<bucket>/<key>) are used, which Arvan and MinIO both accept.
 */
export function s3Config() {
  const endpoint = String(process.env.FRFRO_S3_ENDPOINT || "").replace(/\/+$/, "");
  const bucket = String(process.env.FRFRO_S3_BUCKET || "").trim();
  const accessKey = String(process.env.FRFRO_S3_ACCESS_KEY || "").trim();
  const secretKey = String(process.env.FRFRO_S3_SECRET_KEY || "").trim();
  if (!endpoint || !bucket || !accessKey || !secretKey) return null;
  const publicBase = String(process.env.FRFRO_S3_PUBLIC_URL || `${endpoint}/${bucket}`).replace(/\/+$/, "");
  return { endpoint, bucket, accessKey, secretKey, region: process.env.FRFRO_S3_REGION || "us-east-1", publicBase };
}

const sha256Hex = (data) => createHash("sha256").update(data).digest("hex");
const hmac = (key, data) => createHmac("sha256", key).update(data).digest();

// RFC 3986 encoding of each path segment, as SigV4 requires.
function encodeKey(key) {
  return key.split("/").map((part) => encodeURIComponent(part).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join("/");
}

/** Signs and sends one request. */
export async function s3Request(config, method, key, { body = Buffer.alloc(0), headers = {} } = {}) {
  const url = new URL(`${config.endpoint}/${config.bucket}/${encodeKey(key)}`);
  const sent = signV4(config, method, url, headers, body);
  return fetch(url, {
    method,
    body: method === "PUT" ? body : undefined,
    headers: sent,
    signal: AbortSignal.timeout(15_000)
  });
}

/** The headers to send (Authorization included) for one request: AWS Signature V4, no query string. */
export function signV4(config, method, url, headers, body, now = new Date()) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const all = { ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()])), host: url.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  const names = Object.keys(all).sort();
  const canonical = [method, url.pathname, "", names.map((n) => `${n}:${all[n]}\n`).join(""), names.join(";"), payloadHash].join("\n");
  const scope = `${day}/${config.region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonical)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretKey}`, day), config.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(toSign).digest("hex");
  // fetch sets Host itself from the URL; it is signed but not passed on.
  const { host, ...sent } = all;
  return { ...sent, Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}` };
}
