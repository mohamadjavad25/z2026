import { NextResponse } from "next/server";
import { requireUser, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { listFallbackSalons } from "../../../lib/bookingFallback.js";
import { MAX_BOOKING_PARTS } from "../../../shared/lib/bookingParts.js";
import { strictDayKey } from "../../../lib/validation/bookingSlot.js";
import { parseBookingTime } from "../../../shared/lib/time.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreJson(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return NextResponse.json(body, { ...init, headers });
}

/**
 * GET /api/salon-bookings/fallbacks?salonUserId=&day=&time=&service=…[&service=…] → client only →
 * { salons: [{ id, name, area, avatar }] }: the salons the client follows that list every one of
 * these services and are free at that day and time, to offer as the backup for a request that gets
 * only an hour (see app/lib/bookingFallback.js). Empty for anyone else.
 */
async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (auth.user.type !== "client") return noStoreJson({ data: { salons: [] } });
  const { searchParams } = new URL(request.url);
  const salonUserId = Number(searchParams.get("salonUserId"));
  if (!salonUserId) return noStoreJson({ error: "شناسه سالن نامعتبر است." }, { status: 400 });
  const names = searchParams.getAll("service").map((name) => name.trim()).filter(Boolean);
  if (!names.length || names.length > MAX_BOOKING_PARTS || names.some((name) => name.length > 120)) {
    return noStoreJson({ error: "فهرست خدمات نامعتبر است." }, { status: 400 });
  }
  const bookingDateKey = strictDayKey(String(searchParams.get("day") || "").trim());
  if (!bookingDateKey) return noStoreJson({ error: "روز رزرو نامعتبر است." }, { status: 400 });
  const rawTime = String(searchParams.get("time") || "").trim();
  const time = rawTime ? parseBookingTime(rawTime) : "";
  if (rawTime && !time) return noStoreJson({ error: "ساعت رزرو نامعتبر است." }, { status: 400 });
  const list = await listFallbackSalons({ clientUserId: auth.user.id, salonUserId, names, bookingDateKey, time });
  return noStoreJson({ data: { salons: list } });
}

export const GET = withErrorHandling(_GET);
