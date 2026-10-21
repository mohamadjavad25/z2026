import { json, requireUser, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { listFallbackArtists } from "../../../lib/bookingFallback.js";
import { strictDayKey } from "../../../lib/validation/bookingSlot.js";
import { parseBookingTime } from "../../../shared/lib/time.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/artist-bookings/fallbacks?artistUserId=&service=&day=&time= → client only →
 * { artists: [{ id, name, area, avatar }] }: the artists the client follows that do this service and
 * are free at that day and time, to offer as the backup for a direct request that gets only an hour
 * (see app/lib/bookingFallback.js). Empty for anyone else.
 */
async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (auth.user.type !== "client") return json({ data: { artists: [] } });
  const { searchParams } = new URL(request.url);
  const artistUserId = Number(searchParams.get("artistUserId"));
  if (!artistUserId) return json({ error: "آرتیست نامعتبر است." }, { status: 400 });
  const service = String(searchParams.get("service") || "").trim();
  if (!service || service.length > 200) return json({ error: "خدمت نامعتبر است." }, { status: 400 });
  const bookingDateKey = strictDayKey(String(searchParams.get("day") || "").trim());
  if (!bookingDateKey) return json({ error: "روز رزرو نامعتبر است." }, { status: 400 });
  const rawTime = String(searchParams.get("time") || "").trim();
  const time = rawTime ? parseBookingTime(rawTime) : "";
  if (rawTime && !time) return json({ error: "ساعت رزرو نامعتبر است." }, { status: 400 });
  const list = await listFallbackArtists({ clientUserId: auth.user.id, artistUserId, service, bookingDateKey, time });
  return json({ data: { artists: list } });
}

export const GET = withErrorHandling(_GET);
