import { ensureDb } from "../../../lib/db/connection.js";
import { error, json, readJson, requireUser, withErrorHandling } from "../../../lib/http.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";
import { notifyConnection } from "../../../lib/connectionNotify.js";
import * as connections from "../../../lib/db/repos/connections.js";
import { parseClientCode } from "../../../shared/lib/connectCodes.js";

export const runtime = "nodejs";

// A salon or artist scanned a client's personal code: add that client.
// POST { code } -> { client: { id, name, avatar }, alreadyConnected }
const SCANS_PER_MINUTE = 30;

async function _POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const owner = auth.user;
  if (owner.type !== "salon" && owner.type !== "artist") return error("فقط سالن و آرتیست می‌توانند مشتری اسکن کنند.", 403);
  const limited = await checkRateLimit(`connect-scan:${owner.id}`, SCANS_PER_MINUTE, 60 * 1000);
  if (!limited.ok) return error("اسکن زیاد شد؛ یک دقیقه بعد دوباره امتحان کن.", 429);

  const code = parseClientCode((await readJson(request))?.code);
  if (!code) return error("این کد مشتری فرفرو نیست.");
  const result = await connections.connectByClientCode(owner.id, code);
  if (!result.ok) return error("این کد معتبر نیست؛ از مشتری بخواه کدش را دوباره باز کند.");

  if (!result.alreadyConnected) {
    notifyConnection(result.client.id, {
      title: "به لیستت اضافه شد",
      body: `${owner.name || (owner.type === "salon" ? "سالن" : "آرتیست")} حالا در «سالن و آرتیست من» است؛ از همان‌جا وقت بگیر.`
    });
  }
  return json({ data: { client: result.client, alreadyConnected: result.alreadyConnected } });
}

export const POST = withErrorHandling(_POST);
