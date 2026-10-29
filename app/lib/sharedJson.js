import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { NextResponse } from "next/server";

const gzipAsync = promisify(gzip);

/**
 * A JSON answer that is the same for everyone (the salon and artist directories), turned into text and
 * gzipped once, then sent as is to every visitor until the cache entry expires. Gzipping the 318 KB salon
 * directory cost nginx ~130 ms of CPU per request on the main server (load test of 2026-10-29), so a crowd
 * opening the app at once filled the CPU with the same compression; nginx leaves an answer that already
 * carries Content-Encoding alone.
 */
export async function buildSharedJson(value) {
  const body = JSON.stringify(value);
  return { body, gzipped: await gzipAsync(body, { level: 6 }) };
}

export function sharedJsonResponse(request, { body, gzipped }) {
  const headers = { "Content-Type": "application/json", Vary: "Accept-Encoding" };
  if (/\bgzip\b/.test(request.headers.get("accept-encoding") || "")) {
    return new NextResponse(gzipped, { headers: { ...headers, "Content-Encoding": "gzip" } });
  }
  return new NextResponse(body, { headers });
}
