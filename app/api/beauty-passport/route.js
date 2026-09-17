import { NextResponse } from "next/server";
import { requireUser } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as passport from "../../lib/db/repos/passport.js";

export const runtime = "nodejs";

export async function GET(request) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ passport: passport.getPassport(auth.user.id) });
}

// Activation used to cost 10 "shell" (removed currency) via wallet.changeShellBalance,
// which permanently failed once the shell top-up UI was removed (no way to ever reach
// a positive balance). Activation is free now until a real pricing/payment model exists.
export async function POST(request) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const saved = passport.savePassport(auth.user.id, body || {});
  return NextResponse.json({ passport: saved, data: { passport: saved } });
}
