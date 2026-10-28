import { NextResponse } from "next/server";
import { verifyCronSecret } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { pushAdmins } from "../../../lib/adminPush.js";
import { withErrorHandling } from "../../../lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGES = {
  made: "بکاپ دیشب ساخته نشد.",
  offsite: "بکاپ دیشب ساخته شد ولی به فضای ابری نرسید.",
};

/**
 * Called by the server's nightly backup (scripts/backup/backup-db.sh) when a step fails, with the CRON_SECRET
 * bearer like the other cron routes: pushes the «فرفرو مدیر» app so a silent backup failure gets noticed.
 */
async function _POST(request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 401 });
  }
  await ensureDb();
  const body = await request.json().catch(() => ({}));
  const text = MESSAGES[body?.what] || MESSAGES.made;
  const reached = await pushAdmins({ title: "بکاپ فرفرو", body: text });
  return NextResponse.json({ data: { reached: reached.size } });
}

export const POST = withErrorHandling(_POST);
