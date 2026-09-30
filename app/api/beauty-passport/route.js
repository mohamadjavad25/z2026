import { NextResponse } from "next/server";
import { requireUser, validateBody } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as passport from "../../lib/db/repos/passport.js";
import { passportSchema } from "../../lib/validation/passport.js";

export const runtime = "nodejs";

export async function GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ passport: await passport.getPassport(auth.user.id) });
}

// Activation is free until a real pricing/payment model exists.
export async function POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const v = validateBody(passportSchema, body || {});
  if (!v.ok) return v.response;
  const saved = await passport.savePassport(auth.user.id, v.data);
  return NextResponse.json({ passport: saved, data: { passport: saved } });
}
