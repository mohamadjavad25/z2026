import { NextResponse } from "next/server";
import { requireUser, withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { strictDayKey } from "../../../../lib/validation/bookingSlot.js";
import { checkIpRateLimit, checkRateLimit } from "../../../../lib/rateLimit.js";
import { AVAILABILITY_DAYS_GUEST_PER_IP_MIN } from "../../../../lib/limits.js";
import { freeTimesForDay, readAvailabilityAsk, salonClosedToViewer } from "../../../../lib/salonAvailabilityAsk.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How many days one question may cover: the next two weeks (owner's decision of 2026-11-02). */
const MAX_DAYS_PER_ASK = 14;
/** Days worked out at the same time, so one question never takes over the database. */
const AT_ONCE = 3;

function noStoreJson(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return NextResponse.json(body, { ...init, headers });
}

/**
 * GET /api/salon-bookings/availability/days?salonUserId=&day=…(1 to 14)&service=…[&minutes=…][&people=][&prefer=]
 * → { data: { days: [{ day, times }] } }, in the order the days were asked.
 *
 * The free start times of several days at once, for the client's step form: each day says how many times it has
 * («۴ وقت», «پر») before the client opens it. Every day is the exact answer GET /api/salon-bookings/availability gives
 * for it (same checks, same few-seconds cache), so the count on a day and the times inside it always agree.
 */
async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  const user = auth.ok ? auth.user : { id: 0, type: "client", guest: true };
  // One question here is up to 14 days of work, so it has its own, smaller allowance.
  const limited = user.guest
    ? await checkIpRateLimit(request, "availability-days-guest", AVAILABILITY_DAYS_GUEST_PER_IP_MIN, 60_000)
    : await checkRateLimit(`availability-days:${user.id}`, 60, 60_000);
  if (!limited.ok) return noStoreJson({ error: "یه کم زیاد زدی؛ چند لحظه صبر کن." }, { status: 429 });

  const { searchParams } = new URL(request.url);
  const read = readAvailabilityAsk(searchParams, user);
  if (!read.ok) return noStoreJson({ error: read.error }, { status: 400 });
  const asked = [...new Set(searchParams.getAll("day").map((day) => String(day || "").trim()).filter(Boolean))];
  if (!asked.length || asked.length > MAX_DAYS_PER_ASK) return noStoreJson({ error: "روزها درست نرسید." }, { status: 400 });
  const keys = asked.map((day) => strictDayKey(day));
  if (keys.some((key) => !key)) return noStoreJson({ error: "روز رزرو مشخص نیست." }, { status: 400 });

  if (await salonClosedToViewer(read.ask, user)) return noStoreJson({ data: { days: asked.map((day) => ({ day, times: [] })) } });

  const days = new Array(asked.length);
  for (let start = 0; start < asked.length; start += AT_ONCE) {
    const batch = asked.slice(start, start + AT_ONCE);
    const outcomes = await Promise.all(batch.map((_, offset) => freeTimesForDay(read.ask, keys[start + offset])));
    for (let offset = 0; offset < batch.length; offset += 1) {
      const outcome = outcomes[offset];
      // The same refusal holds for every day (an unknown service, a salon that is gone): answer it once.
      if (outcome.error) return noStoreJson({ error: outcome.error }, { status: outcome.status });
      days[start + offset] = { day: batch[offset], times: outcome.data.times };
    }
  }
  return noStoreJson({ data: { days } });
}

export const GET = withErrorHandling(_GET);
