import { NextResponse } from "next/server";
import { ensureDb } from "../../lib/db/connection.js";
import * as salons from "../../lib/db/repos/salons.js";

export const runtime = "nodejs";

export async function GET() {
  await ensureDb();
  const list = await salons.listSalons();
  return NextResponse.json({ salons: list });
}
