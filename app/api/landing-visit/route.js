import { NextResponse } from "next/server";
import { z } from "zod";
import { checkIpRateLimit } from "../../lib/rateLimit.js";
import { withErrorHandling } from "../../lib/http.js";
import { countLandingVisit, VISIT_KINDS } from "../../lib/db/repos/landingVisits.js";

export const runtime = "nodejs";

// Public beacon from /go: counts one open / enter / download tap. No account, no personal data, throttled per address.
const schema = z.object({ source: z.string().max(24).optional(), kind: z.enum(VISIT_KINDS) });

async function _POST(request) {
  const limited = await checkIpRateLimit(request, "landing-visit", 30, 60 * 1000);
  if (!limited.ok) return NextResponse.json({ ok: false }, { status: 429 });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  await countLandingVisit(parsed.data.source, parsed.data.kind);
  return NextResponse.json({ ok: true });
}

export const POST = withErrorHandling(_POST);
