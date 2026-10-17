import { error, json, readJson, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { adminPhoneList, requireAdmin, requireStepUp } from "../../../lib/admin.js";
import { adminAuthConfigured, setupKeyConfigured } from "../../../lib/adminAuth.js";
import { otpConfig } from "../../../lib/otp.js";
import { smsProviderName } from "../../../lib/sms.js";
import { isStorageConfigured } from "../../../lib/storage.js";
import * as admin from "../../../lib/db/repos/admin.js";
import * as control from "../../../lib/db/repos/adminControl.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which pieces of the setup are in place. Only yes/no (and the public site address): never a secret's value. */
function configuration() {
  const env = process.env;
  const vapid = Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.FRFRO_VAPID_PRIVATE_KEY && env.FRFRO_VAPID_CONTACT);
  return {
    adminSecret: adminAuthConfigured(),
    setupKey: setupKeyConfigured(),
    adminPhones: adminPhoneList().length,
    legacyToken: Boolean(env.FRFRO_ADMIN_TOKEN),
    sms: smsProviderName(),
    otpRequired: otpConfig().required,
    push: vapid,
    storage: isStorageConfigured(),
    cron: Boolean(env.CRON_SECRET),
    siteUrl: env.NEXT_PUBLIC_SITE_URL || "",
    version: (env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 7),
    region: env.VERCEL_REGION || "",
    environment: env.VERCEL_ENV || env.NODE_ENV || ""
  };
}

/** GET: the health page in one call. */
async function _GET(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const [health, sms, errors] = await Promise.all([
    control.getSystemHealth(),
    admin.getSmsStatus(smsProviderName()),
    control.listClientErrors({ days: 7 })
  ]);
  return json({ data: { health, sms, errors, config: configuration(), uptimeSeconds: Math.round(process.uptime()), checkedAt: new Date().toISOString() } });
}

/** POST { action: "cleanup" | "clear_errors" }: housekeeping. Clearing the crash list needs a fresh password check. */
async function _POST(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const action = String(((await readJson(request)) || {}).action || "");
  if (action === "cleanup") {
    const removed = await control.runCleanup();
    await admin.logAction({ adminUserId: gate.admin.id, adminLabel: gate.admin.label, action: "cleanup", detail: `نشست منقضی: ${removed.sessions} • ردیف محدودیت: ${removed.rateLimits}` });
    return json({ data: removed });
  }
  if (action === "clear_errors") {
    const stepUp = requireStepUp(gate);
    if (stepUp) return stepUp;
    const removed = await control.clearClientErrors();
    await admin.logAction({ adminUserId: gate.admin.id, adminLabel: gate.admin.label, action: "clear_errors", detail: `${removed} خطا` });
    return json({ data: { removed } });
  }
  return error("درخواست نامعتبر است.", 400);
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
