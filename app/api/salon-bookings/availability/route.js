import { NextResponse } from "next/server";
import { requireUser, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { strictDayKey } from "../../../lib/validation/bookingSlot.js";
import { checkIpRateLimit } from "../../../lib/rateLimit.js";
import { freeTimesForDay, readAvailabilityAsk, salonClosedToViewer } from "../../../lib/salonAvailabilityAsk.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreJson(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return NextResponse.json(body, { ...init, headers });
}

/**
 * GET /api/salon-bookings/availability?salonUserId=&day=&service=…[&service=…][&minutes=…]
 * The start times on that day at which one service, or several back to back in this order, can
 * be requested: the same checks a client's POST goes through (listFeasibleVisitTimes), so the
 * client is only offered times that will be accepted. `minutes` (one per service, same order)
 * is used only for a service the salon does not list. A client's `prefer` (a team member's name, «رزرو با …»)
 * keeps only the times at which that person can do every service.
 */
async function _GET(request) {
  await ensureDb();
  // A visitor not signed in (from an Instagram story, owner's decision of 2026-11-02) sees the free times a client
  // would: they pick everything first and sign in only to send. Read-only; limited per address.
  const auth = await requireUser(request);
  const user = auth.ok ? auth.user : { id: 0, type: "client", guest: true };
  if (user.guest) {
    // Generous: many visitors from one story can share a mobile operator's address.
    const limited = await checkIpRateLimit(request, "availability-guest", 300, 60_000);
    if (!limited.ok) return noStoreJson({ error: "یه کم زیاد زدی؛ چند لحظه صبر کن." }, { status: 429 });
  }
  const { searchParams } = new URL(request.url);
  if (!Number(searchParams.get("salonUserId"))) return noStoreJson({ error: "این سالن رو پیدا نکردیم." }, { status: 400 });
  const day = String(searchParams.get("day") || "").trim();
  const bookingDateKey = strictDayKey(day);
  if (!day || !bookingDateKey) return noStoreJson({ error: "روز رزرو مشخص نیست." }, { status: 400 });
  const read = readAvailabilityAsk(searchParams, user);
  if (!read.ok) return noStoreJson({ error: read.error }, { status: 400 });
  if (await salonClosedToViewer(read.ask, user)) return noStoreJson({ data: { times: [], durationMinutes: 0 } });
  const outcome = await freeTimesForDay(read.ask, bookingDateKey);
  if (outcome.error) return noStoreJson({ error: outcome.error }, { status: outcome.status });
  return noStoreJson({ data: outcome.data });
}

export const GET = withErrorHandling(_GET);
