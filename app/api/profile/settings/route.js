import { NextResponse } from "next/server";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireUser, validateBody } from "../../../lib/http.js";
import * as userSettings from "../../../lib/db/repos/userSettings.js";
import { settingsPatchSchema } from "../../../lib/validation/settings.js";

export const runtime = "nodejs";

export async function GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ settings: await userSettings.getSettings(auth.user.id) });
}

export async function POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const rawPatch = body?.settings && typeof body.settings === "object" ? body.settings : body;
  if (!rawPatch || typeof rawPatch !== "object") {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }
  const v = validateBody(settingsPatchSchema, rawPatch);
  if (!v.ok) return v.response;
  const settings = await userSettings.saveSettings(auth.user.id, v.data);
  return NextResponse.json({ settings });
}
