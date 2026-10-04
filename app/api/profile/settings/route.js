import { NextResponse } from "next/server";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireUser, validateBody, withErrorHandling } from "../../../lib/http.js";
import * as userSettings from "../../../lib/db/repos/userSettings.js";
import { settingsPatchSchema } from "../../../lib/validation/settings.js";

export const runtime = "nodejs";

async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ data: { settings: await userSettings.getSettings(auth.user.id) } });
}

async function _POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const rawPatch = body?.settings && typeof body.settings === "object" ? body.settings : body;
  if (!rawPatch || typeof rawPatch !== "object") {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }
  const v = validateBody(settingsPatchSchema, rawPatch);
  if (!v.ok) return NextResponse.json({ error: "مقدار تنظیمات نامعتبر است؛ دوباره امتحان کن." }, { status: 400 });
  const settings = await userSettings.saveSettings(auth.user.id, v.data);
  return NextResponse.json({ data: { settings } });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
