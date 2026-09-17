import { NextResponse } from "next/server";
import { ensureDb } from "../../../lib/db/connection.js";
import * as salons from "../../../lib/db/repos/salons.js";

export const runtime = "nodejs";

export async function GET(_request, context) {
  ensureDb();
  const params = await context?.params;
  const userId = Number(params?.id);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "شناسه سالن نامعتبر است." }, { status: 400 });
  }
  const salon = salons.getSalon(userId);
  if (!salon) {
    return NextResponse.json({ error: "سالن پیدا نشد." }, { status: 404 });
  }
  return NextResponse.json({ salon });
}
