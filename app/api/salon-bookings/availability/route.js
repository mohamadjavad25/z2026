import { NextResponse } from "next/server";
import { requireUser, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as salons from "../../../lib/db/repos/salons.js";
import { salonVisitParts } from "../../../lib/salonVisitParts.js";
import { isSlotInPast } from "../../../shared/lib/slots.js";
import { MAX_BOOKING_PARTS, summarizeBookingParts } from "../../../shared/lib/bookingParts.js";
import { resolveRollingPersianDateKey } from "../../../shared/lib/persianCalendar.js";
import { findSalonHourForDateKey, isSalonHourOpen, salonDayWindow } from "../../../shared/lib/salonAvailability.js";
import { buildDayBookingSlots } from "../../../shared/lib/time.js";

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
 * is used only for a service the salon does not list.
 */
async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const salonUserId = Number(searchParams.get("salonUserId"));
  if (!salonUserId) return noStoreJson({ error: "شناسه سالن نامعتبر است." }, { status: 400 });
  const day = String(searchParams.get("day") || "").trim();
  const bookingDateKey = resolveRollingPersianDateKey(day);
  if (!day || !bookingDateKey) return noStoreJson({ error: "روز رزرو مشخص نیست." }, { status: 400 });
  const names = searchParams.getAll("service").map((name) => name.trim()).filter(Boolean);
  if (!names.length || names.length > MAX_BOOKING_PARTS || names.some((name) => name.length > 120)) {
    return noStoreJson({ error: "فهرست خدمات نامعتبر است." }, { status: 400 });
  }
  const salon = await salons.getSalon(salonUserId);
  if (!salon) return noStoreJson({ error: "سالن پیدا نشد." }, { status: 404 });
  const minutes = searchParams.getAll("minutes").map(Number);
  const parts = salonVisitParts(salon, names.map((service, index) => ({ service, durationMinutes: minutes[index] })));
  const missing = parts.find((part, index) => !part.listed && !(minutes[index] > 0));
  if (missing) return noStoreJson({ error: `«${missing.service}» در خدمات این سالن نیست.` }, { status: 400 });

  const { durationMinutes } = summarizeBookingParts(parts);
  const hour = findSalonHourForDateKey(await salons.listSalonHours(salonUserId), bookingDateKey);
  let times = [];
  if (isSalonHourOpen(hour)) {
    const window = salonDayWindow(hour);
    const candidates = buildDayBookingSlots(window.open, window.close, durationMinutes)
      .filter((time) => !isSlotInPast(bookingDateKey, time));
    times = await salons.listFeasibleVisitTimes(salonUserId, bookingDateKey, parts, candidates);
  }
  return noStoreJson({ data: { times, durationMinutes } });
}

export const GET = withErrorHandling(_GET);
