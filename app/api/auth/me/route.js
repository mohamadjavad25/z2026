import { NextResponse } from "next/server";
import { getUserFromRequest, publicUser } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";

export const runtime = "nodejs";

export async function GET(request) {
  await ensureDb();
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ data: { user: null } });
  }
  return NextResponse.json({ data: { user: publicUser(user) }, profile: publicUser(user) });
}
