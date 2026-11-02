import { NextResponse } from "next/server";
import { requireUser, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { MAX_BOOKING_PARTS, MAX_GROUP_PEOPLE } from "../../../shared/lib/bookingParts.js";
import { computeSalonFreeTimes as computeTimes } from "../../../lib/salonFreeTimes.js";
import { strictDayKey } from "../../../lib/validation/bookingSlot.js";
import { onlineBookingBlock } from "../../../lib/billing/access.js";
import { availabilityKey, cachedAvailability } from "../../../lib/availabilityCache.js";

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
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const salonUserId = Number(searchParams.get("salonUserId"));
  if (!salonUserId) return noStoreJson({ error: "این سالن رو پیدا نکردیم." }, { status: 400 });
  const day = String(searchParams.get("day") || "").trim();
  const bookingDateKey = strictDayKey(day);
  if (!day || !bookingDateKey) return noStoreJson({ error: "روز رزرو مشخص نیست." }, { status: 400 });
  const names = searchParams.getAll("service").map((name) => name.trim()).filter(Boolean);
  if (!names.length || names.length > MAX_BOOKING_PARTS || names.some((name) => name.length > 120)) {
    return noStoreJson({ error: "کارها درست نرسید؛ دوباره انتخاب کن." }, { status: 400 });
  }
  // A salon that takes no new requests (suspended, or its subscription closed) offers no free times to anyone but itself.
  if (auth.user.id !== salonUserId && await onlineBookingBlock(salonUserId, "salon")) {
    return noStoreJson({ data: { times: [], durationMinutes: 0 } });
  }
  const minutes = searchParams.getAll("minutes").map(Number);
  const isClient = auth.user.type === "client";
  // The same salon, day and services asked within a few seconds share one answer (see availabilityCache.js).
  // It only decides what the page shows: booking itself re-checks under row locks.
  // A group (2 or 3 people at the same time, a client's request only) needs that many artists free together.
  const people = isClient ? Math.max(1, Math.min(MAX_GROUP_PEOPLE, Math.floor(Number(searchParams.get("people"))) || 1)) : 1;
  const prefer = isClient && people < 2 ? String(searchParams.get("prefer") || "").trim().slice(0, 120) : "";
  if (names.length * people > MAX_BOOKING_PARTS) return noStoreJson({ error: "کارها درست نرسید؛ دوباره انتخاب کن." }, { status: 400 });
  const key = availabilityKey(salonUserId, bookingDateKey, [...names.map((service, index) => ({ service, minutes: minutes[index] || 0 })), ...(people > 1 ? [{ service: "people", minutes: people }] : []), ...(prefer ? [{ service: `prefer:${prefer}`, minutes: 0 }] : [])], isClient);
  const outcome = await cachedAvailability(salonUserId, key, () => computeTimes(salonUserId, bookingDateKey, names, minutes, isClient, people, prefer));
  if (outcome.error) return noStoreJson({ error: outcome.error }, { status: outcome.status });
  return noStoreJson({ data: outcome.data });
}

export const GET = withErrorHandling(_GET);
