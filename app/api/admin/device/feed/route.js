import { ensureDb, getDb, get } from "../../../../../lib/db/connection.js";
import * as adminDevice from "../../../../../lib/db/repos/adminDevice.js";
import { countActive } from "../../../../../lib/db/repos/support.js";
import { countRecentPaid } from "../../../../../lib/db/repos/billing.js";
import { ensureControlTables } from "../../../../../lib/db/repos/adminControl.js";
import { checkRateLimit, clientIp } from "../../../../../lib/rateLimit.js";
import { error, json, withErrorHandling } from "../../../../../lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function counts() {
  await ensureControlTables();
  const db = await getDb();
  return get(db, `
    SELECT
      (SELECT COUNT(*)::int FROM salon_bookings WHERE status IN ('تازه', 'درخواست'))
        + (SELECT COUNT(*)::int FROM artist_bookings WHERE source_salon_user_id IS NULL AND status IN ('تازه', 'درخواست')) AS waiting,
      (SELECT COUNT(*)::int FROM users WHERE created_at >= NOW() - INTERVAL '24 hours') AS signups,
      (SELECT COUNT(*)::int FROM users WHERE last_seen_at >= NOW() - INTERVAL '5 minutes') AS online,
      (SELECT COUNT(*)::int FROM password_reset_requests WHERE status = 'pending') AS resets
  `);
}

/**
 * GET with "Authorization: Bearer <key>": the few numbers the «فرفرو مدیر» app shows on its wallpaper and "always on"
 * notification (mobile/android/app/src/admin). Counts only, never a name, phone or message. The key comes from
 * POST /api/admin/device and opens nothing else.
 */
async function _GET(request) {
  await ensureDb();
  if (!(await checkRateLimit(`admin-device-feed-ip:${clientIp(request)}`, 120, 15 * 60 * 1000)).ok) return error("کمی بعد دوباره امتحان کن.", 429);
  const header = request.headers.get("authorization") || "";
  const admin = await adminDevice.resolveToken(header.startsWith("Bearer ") ? header.slice(7).trim() : "");
  if (!admin) return error("دسترسی ندارید.", 401);
  const [support, paid, rest] = await Promise.all([countActive().catch(() => 0), countRecentPaid().catch(() => 0), counts().catch(() => null)]);
  return json({
    data: {
      support,
      waiting: rest?.waiting || 0,
      paid,
      signups: rest?.signups || 0,
      online: rest?.online || 0,
      resets: rest?.resets || 0,
      at: new Date().toISOString()
    }
  });
}

export const GET = withErrorHandling(_GET);
