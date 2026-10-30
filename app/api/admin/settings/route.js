import { z } from "zod";
import { error, json, readJson, validateBody, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { requireAdmin } from "../../../lib/admin.js";
import * as admin from "../../../lib/db/repos/admin.js";
import * as control from "../../../lib/db/repos/adminControl.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A link in the notice is either a page of the app ("/...") or a secure web address.
const link = z.string().trim().max(300).refine((value) => !value || value.startsWith("/") || value.startsWith("https://"), "پیوند باید با / یا https:// شروع شود.");

const SCHEMAS = {
  notice: z.object({
    enabled: z.boolean(),
    text: z.string().trim().max(240, "متن اعلان حداکثر ۲۴۰ حرف است."),
    tone: z.enum(["info", "success", "warning"]),
    audience: z.enum(["all", "client", "pro"]),
    link,
    linkLabel: z.string().trim().max(40, "متن دکمه حداکثر ۴۰ حرف است.")
  }).refine((value) => !value.enabled || value.text.length >= 3, "برای روشن‌کردن اعلان، متنش را بنویس."),
  signups: z.object({
    client: z.boolean(),
    artist: z.boolean(),
    salon: z.boolean(),
    message: z.string().trim().max(200, "پیام حداکثر ۲۰۰ حرف است.")
  }),
  replies: z.object({
    items: z.array(z.object({
      id: z.string().trim().min(1).max(24),
      title: z.string().trim().min(1, "عنوان پاسخ آماده را بنویس.").max(60, "عنوان حداکثر ۶۰ حرف است."),
      body: z.string().trim().min(2, "متن پاسخ آماده را بنویس.").max(2000, "متن حداکثر ۲۰۰۰ حرف است.")
    })).max(40, "حداکثر ۴۰ پاسخ آماده.")
  }),
  androidApp: z.object({
    latestBuild: z.number().int().min(1, "شمارهٔ ساخت باید ۱ یا بیشتر باشد.").max(100000),
    forceUpdate: z.boolean()
  })
};

async function _GET(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  return json({ data: await control.getSettings() });
}

/** PUT { key, value }: saves one setting. Every change is in the audit log. */
async function _PUT(request) {
  await ensureDb();
  const gate = await requireAdmin(request);
  if (!gate.ok) return error("دسترسی مجاز نیست.", 403);
  const body = (await readJson(request)) || {};
  const schema = SCHEMAS[body.key];
  if (!schema) return error("تنظیم نامعتبر است.", 400);
  const valid = validateBody(schema, body.value);
  if (!valid.ok) return valid.response;
  const saved = await control.saveSetting(body.key, valid.data, gate.admin.label);
  const summary = body.key === "notice"
    ? `اعلان: ${valid.data.enabled ? "روشن" : "خاموش"} • ${valid.data.text.slice(0, 80)}`
    : body.key === "signups"
      ? `ثبت‌نام: ${["client", "artist", "salon"].filter((role) => valid.data[role]).join("، ") || "بسته"}`
      : body.key === "androidApp"
        ? `اپ اندروید: آخرین ساخت ${valid.data.latestBuild}${valid.data.forceUpdate ? " • به‌روزرسانی اجباری" : ""}`
        : `پاسخ‌های آماده: ${valid.data.items.length}`;
  await admin.logAction({ adminLabel: gate.admin.label, action: "settings_update", detail: summary });
  return json({ data: { [body.key]: saved } });
}

export const GET = withErrorHandling(_GET);
export const PUT = withErrorHandling(_PUT);
