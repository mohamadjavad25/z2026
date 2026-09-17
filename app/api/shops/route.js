import { NextResponse } from "next/server";
import { ensureDb } from "../../lib/db/connection.js";
import * as shops from "../../lib/db/repos/shops.js";

export const runtime = "nodejs";

export async function GET() {
  ensureDb();
  const list = shops.listShops();
  return NextResponse.json({ data: { shops: list }, shops: list });
}
