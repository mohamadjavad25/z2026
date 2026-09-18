import { NextResponse } from "next/server";
import { getDb } from "../../lib/db/connection.js";

export const runtime = "nodejs";

/**
 * Minimal liveness/readiness probe for whatever host ends up running this
 * app (VPS process manager, container orchestrator, uptime monitor, load
 * balancer health check — none of these are chosen yet, this just gives
 * infra a real, cheap thing to point at once one is). Deliberately public
 * (no auth) and deliberately tiny: confirms the process is up AND the
 * SQLite connection actually works (a real query, not just "the file
 * exists"), without leaking any app data or internals in the response.
 */
export async function GET() {
  try {
    const db = getDb();
    db.prepare("SELECT 1").get();
    return NextResponse.json({ ok: true, uptimeSeconds: Math.round(process.uptime()) });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
