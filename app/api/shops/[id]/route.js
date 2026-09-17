import { NextResponse } from "next/server";
import { ensureDb } from "../../../lib/db/connection.js";
import { getUserFromRequest } from "../../../lib/auth.js";
import * as shops from "../../../lib/db/repos/shops.js";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  ensureDb();
  const { id } = await params;
  const shopUserId = Number(id);
  const shop = shops.getShop(shopUserId);
  if (!shop) return NextResponse.json({ error: "فروشگاه یافت نشد." }, { status: 404 });
  // A shop switched to "خصوصی" in تنظیمات is only visible to its own owner.
  const viewer = getUserFromRequest(request);
  if (!shop.isPublic && viewer?.id !== shopUserId) {
    return NextResponse.json({ error: "فروشگاه یافت نشد." }, { status: 404 });
  }
  return NextResponse.json({ data: { shop } });
}
