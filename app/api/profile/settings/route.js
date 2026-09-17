import { NextResponse } from "next/server";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireUser } from "../../../lib/http.js";
import * as userSettings from "../../../lib/db/repos/userSettings.js";

export const runtime = "nodejs";

export async function GET(request) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ settings: userSettings.getSettings(auth.user.id) });
}

export async function POST(request) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const patch = body?.settings && typeof body.settings === "object" ? body.settings : body;
  if (!patch || typeof patch !== "object") {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }
  const settings = userSettings.saveSettings(auth.user.id, patch);
  return NextResponse.json({ settings });
}
