import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "../../lib/auth.js";
import { logger } from "../../lib/logger.js";
import { clientIp } from "../../lib/rateLimit.js";
import { withErrorHandling } from "../../lib/http.js";
import { databaseIsBusy } from "../../lib/db/connection.js";
import { deviceOf, recordActivity } from "../../lib/db/repos/activity.js";

export const runtime = "nodejs";

// The footprint's batches (app/shared/lib/activity.js). Public: a visitor without an account counts too. Every limit
// is counted in memory, before any query, so a flood costs no database time; losing a batch loses nothing that matters.
// A batch costs 1 plus its events, so the budget limits rows, not just requests: nothing here is ever deleted.
const MAX_PER_MINUTE = 6000;
const MAX_PER_MINUTE_PER_IP = 300;
const MAX_BODY_BYTES = 16 * 1024;
const WINDOW_MS = 60 * 1000;

let windowStart = 0;
let windowCount = 0;
let perIp = new Map();
function overBudget(ip, cost, now = Date.now()) {
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
    perIp = new Map();
  }
  windowCount += cost;
  const count = (perIp.get(ip) || 0) + cost;
  perIp.set(ip, count);
  return windowCount > MAX_PER_MINUTE || count > MAX_PER_MINUTE_PER_IP;
}

/** The body as JSON, or null past the size cap. Reads the stream itself, because a chunked body has no stated length. */
async function readSmallJson(request) {
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const randomId = z.string().regex(/^[A-Za-z0-9-]{16,40}$/);
const schema = z.object({
  visitor: randomId,
  visit: randomId,
  source: z.string().max(40).regex(/^[A-Za-z0-9._-]*$/).optional(),
  events: z.array(z.object({
    k: z.enum(["screen", "action"]),
    n: z.string().regex(/^[a-z0-9_:.-]{1,60}$/),
    p: z.number().int().positive().max(2147483647).optional(),
    ago: z.number().int().min(0).max(60 * 60 * 1000)
  })).max(40)
});

async function _POST(request) {
  const ip = clientIp(request) || "unknown";
  if (overBudget(ip, 1)) return new NextResponse(null, { status: 429 });
  let body;
  try {
    body = await readSmallJson(request);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  if (overBudget(ip, parsed.data.events.length)) return new NextResponse(null, { status: 429 });
  // Bookings first: when the database is busy this batch simply does not happen.
  if (databaseIsBusy()) return new NextResponse(null, { status: 204 });
  try {
    // The account comes from the session, never from the batch, so nobody can write into someone else's footprint.
    const user = await getUserFromRequest(request).catch(() => null);
    const { visit, visitor, source, events } = parsed.data;
    // Looking at your own public page is not a visitor.
    const counted = events.filter((event) => !(user && event.k === "screen" && event.p === user.id));
    await recordActivity({ visitId: visit, visitorId: visitor, userId: user?.id ?? null, device: deviceOf(request.headers.get("user-agent")), source: source || "", events: counted });
  } catch (cause) {
    logger.warn("activity batch dropped", { error: String(cause?.message || cause) });
  }
  return new NextResponse(null, { status: 204 });
}

export const POST = withErrorHandling(_POST);
