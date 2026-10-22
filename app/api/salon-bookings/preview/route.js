import { NextResponse } from "next/server";
import { requireUser, withErrorHandling } from "../../../lib/http.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as salons from "../../../lib/db/repos/salons.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";
import { salonVisitParts } from "../../../lib/salonVisitParts.js";
import { visitSlotProblem } from "../../../lib/visitSlotRules.js";
import { onlineBookingBlock } from "../../../lib/billing/access.js";
import { MAX_BOOKING_PARTS, MAX_GROUP_PEOPLE, expandPartsForPeople, summarizeBookingParts } from "../../../shared/lib/bookingParts.js";
import { strictDayKey } from "../../../lib/validation/bookingSlot.js";
import { toPersianDigits } from "../../../shared/lib/digits.js";
import { parseBookingTime, timeLabelToMinutes } from "../../../shared/lib/time.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreJson(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return NextResponse.json(body, { ...init, headers });
}

/**
 * GET /api/salon-bookings/preview?salonUserId=&day=&time=&service=…[&service=…][&minutes=…][&staff=…]
 * → { data: { ok, code?, message?, durationMinutes, end, parts: [{ service, minutes, start, end, staff }] } }
 *
 * Who would do what, and when, if this visit (one service or several back to back, in this order)
 * were booked at `time`: the same split and the same checks POST /api/salon-bookings runs
 * (visitSlotProblem, previewVisit), so a screen can show it before booking and be right.
 * `ok: false` carries why (`code`, `message`, and `partIndex` for a problem with one service) --
 * a refused plan is an answer, not an error. `minutes` / `staff` go with the services, same order.
 *
 * The salon itself (its own id) may name an artist per service with `staff` and also gets, per
 * service, `free` and `options` (every team member with free/skilled/away) for its artist picker.
 * Anyone else is a client: `staff` is ignored, they only see the names, and a visit that would
 * leave a service without a free artist is refused, as their request would be.
 */
async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const salonUserId = Number(searchParams.get("salonUserId"));
  if (!salonUserId) return noStoreJson({ error: "شناسه سالن نامعتبر است." }, { status: 400 });
  const owner = auth.user.type === "salon" && auth.user.id === salonUserId;
  if (!owner && auth.user.type !== "client") return noStoreJson({ error: "فقط مشتری یا خود سالن." }, { status: 403 });
  const limited = await checkRateLimit(`visit-preview:${auth.user.id}`, 120, 60_000);
  if (!limited.ok) return noStoreJson({ error: "درخواست‌های زیاد. کمی صبر کن." }, { status: 429 });

  const day = String(searchParams.get("day") || "").trim();
  const bookingDateKey = strictDayKey(day);
  if (!day || !bookingDateKey) return noStoreJson({ error: "روز رزرو مشخص نیست." }, { status: 400 });
  // Strict on purpose: "HH:MM" (Persian or Latin digits) on a real clock, nothing the lenient
  // booking parser would turn into some other time.
  const time = parseBookingTime(String(searchParams.get("time") || ""));
  if (!time) return noStoreJson({ error: "ساعت رزرو نامعتبر است." }, { status: 400 });
  const names = searchParams.getAll("service").map((name) => name.trim());
  if (!names.length || names.length > MAX_BOOKING_PARTS || names.some((name) => !name || name.length > 120)) {
    return noStoreJson({ error: "فهرست خدمات نامعتبر است." }, { status: 400 });
  }
  const salon = await salons.getSalon(salonUserId);
  if (!salon) return noStoreJson({ error: "سالن پیدا نشد." }, { status: 404 });
  if (!owner) {
    const blocked = await onlineBookingBlock(salonUserId, "salon");
    if (blocked) return noStoreJson({ data: { ok: false, code: blocked.code, message: blocked.error, durationMinutes: 0, end: 0, parts: [] } });
  }
  const minutes = searchParams.getAll("minutes").map(Number);
  const staff = searchParams.getAll("staff");
  // A client may ask for a group (2 or 3 people, same services, same time): see expandPartsForPeople.
  const people = owner ? 1 : Math.max(1, Math.min(MAX_GROUP_PEOPLE, Math.floor(Number(searchParams.get("people"))) || 1));
  if (names.length * people > MAX_BOOKING_PARTS) return noStoreJson({ error: "فهرست خدمات نامعتبر است." }, { status: 400 });
  const single = salonVisitParts(
    salon,
    names.map((service, index) => ({ service, durationMinutes: minutes[index], staff: staff[index] })),
    { allowStaff: owner }
  );
  const parts = people > 1 ? expandPartsForPeople(single.map((part) => ({ ...part, staff: "" })), people).map((part, index) => ({ ...single[index % single.length], ...part })) : single;
  const missing = single.find((part, index) => !part.listed && !(minutes[index] > 0));
  if (missing) return noStoreJson({ error: `«${missing.service}» در خدمات این سالن نیست.` }, { status: 400 });

  const { durationMinutes } = summarizeBookingParts(parts);
  const slotProblem = visitSlotProblem({
    hours: await salons.listSalonHours(salonUserId),
    bookingDateKey,
    time,
    durationMinutes,
    isClient: !owner
  });
  const base = { durationMinutes, end: timeLabelToMinutes(time) + durationMinutes };
  if (slotProblem) {
    return noStoreJson({ data: { ...base, ok: false, code: slotProblem.code, message: slotProblem.error, parts: [] } });
  }
  const plan = await salons.previewVisit(salonUserId, bookingDateKey, time, parts, { withOptions: owner });
  // A client's request is refused first for a service nobody is free to do, as POST does (before
  // its overlap check); the salon's own entry may leave one open.
  let problem = plan.problem;
  if (!owner && plan.unstaffed >= 0) {
    const part = plan.parts[plan.unstaffed];
    problem = people > 1
      ? { code: "NO_FREE_ARTIST", partIndex: -1, message: `این ساعت دیگر برای ${toPersianDigits(people)} نفر جا ندارد؛ ساعت‌ها به‌روز شد.` }
      : { code: "NO_FREE_ARTIST", partIndex: plan.unstaffed, message: `برای «${part.service}» در این ساعت آرتیست آزادی نیست.` };
  }
  const shown = plan.parts.map((part) => {
    const { unknownStaff, free, options, ...rest } = part;
    return owner ? { ...rest, free, unknownStaff, options } : rest;
  });
  return noStoreJson({
    data: {
      ...base,
      ok: !problem,
      ...(problem ? { code: problem.code, message: problem.message, partIndex: problem.partIndex } : {}),
      parts: shown
    }
  });
}

export const GET = withErrorHandling(_GET);
