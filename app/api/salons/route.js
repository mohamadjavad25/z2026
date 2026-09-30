import { NextResponse } from "next/server";
import { ensureDb } from "../../lib/db/connection.js";
import * as salons from "../../lib/db/repos/salons.js";
import { withErrorHandling } from "../../lib/http.js";

export const runtime = "nodejs";

async function _GET() {
  await ensureDb();
  const list = await salons.listSalons();
  return NextResponse.json({ salons: list });
}

export const GET = withErrorHandling(_GET);
