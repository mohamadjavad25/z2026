import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  destroySession,
  getSessionToken
} from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { withErrorHandling } from "../../../lib/http.js";

export const runtime = "nodejs";

async function _POST(request) {
  await ensureDb();
  const token = getSessionToken(request);
  await destroySession(token);
  const response = NextResponse.json({ data: { ok: true } });
  clearSessionCookie(response);
  return response;
}

export const POST = withErrorHandling(_POST);
