import { NextResponse } from "next/server";
import { requireUser } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as passport from "../../lib/db/repos/passport.js";

export const runtime = "nodejs";

export async function GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ passport: await passport.getPassport(auth.user.id) });
}

// Activation is free until a real pricing/payment model exists (the app has
// no wallet or payment gateway).
export async function POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const saved = await passport.savePassport(auth.user.id, body || {});
  return NextResponse.json({ passport: saved, data: { passport: saved } });
}
