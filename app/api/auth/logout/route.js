import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  destroySession,
  getSessionToken
} from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";

export const runtime = "nodejs";

export async function POST(request) {
  ensureDb();
  const token = getSessionToken(request);
  destroySession(token);
  const response = NextResponse.json({ data: { ok: true } });
  clearSessionCookie(response);
  return response;
}
