import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "../../lib/logger.js";
import { checkRateLimit } from "../../lib/rateLimit.js";
import { withErrorHandling } from "../../lib/http.js";

export const runtime = "nodejs";

// Browser-side crashes land here so they show up next to the server logs
// (structured JSON on stdout) instead of dying in the user's console. Public and
// unauthenticated on purpose -- a crash can happen before login -- so it is
// size-capped and throttled globally, and only ever writes a log line.
const MAX_PER_MINUTE = 60;

const schema = z.object({
  message: z.string().max(500),
  stack: z.string().max(4000).optional(),
  source: z.string().max(60).optional(),
  url: z.string().max(300).optional(),
  userAgent: z.string().max(300).optional()
});

async function _POST(request) {
  const limited = await checkRateLimit("client-errors", MAX_PER_MINUTE, 60 * 1000);
  if (!limited.ok) return NextResponse.json({ ok: false }, { status: 429 });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  logger.error("client error", { source: parsed.data.source || "window", clientError: parsed.data });
  return NextResponse.json({ ok: true });
}

export const POST = withErrorHandling(_POST);
