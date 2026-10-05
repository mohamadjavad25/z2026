import { error, json, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireAdmin } from "../../../lib/admin.js";
import { otpConfig } from "../../../lib/otp.js";
import { smsProviderName } from "../../../lib/sms.js";
import * as admin from "../../../lib/db/repos/admin.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _GET(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const provider = smsProviderName();
  const phone = new URL(request.url).searchParams.get("phone");
  const latest = provider === "test" && phone ? await admin.latestTestSms(phone) : null;
  return json({ data: { ...(await admin.getSmsStatus(provider)), config: otpConfig(), latestTestCode: latest?.body || null } });
}

export const GET = withErrorHandling(_GET);
