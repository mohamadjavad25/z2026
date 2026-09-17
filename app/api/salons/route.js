import { NextResponse } from "next/server";
import { ensureDb } from "../../lib/db/connection.js";
import * as salons from "../../lib/db/repos/salons.js";

export const runtime = "nodejs";

export async function GET() {
  ensureDb();
  const list = salons.listSalons();
  return NextResponse.json({ salons: list });
}
