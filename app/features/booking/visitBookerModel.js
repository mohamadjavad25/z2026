import { serviceKey, joinServiceNames } from "../../shared/lib/serviceBundle.js";
import { MAX_BOOKING_PARTS, scheduleBookingParts } from "../../shared/lib/bookingParts.js";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits.js";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money.js";
import { parseServiceDurationMinutes, minutesToPersianTime, timeLabelToMinutes } from "../../shared/lib/time.js";

/**
 * The logic of the multi-service booking form (VisitBooker), with no React in it: what the picks
 * mean, what they invalidate, whether the visit can be sent, and the body that is sent. Times and
 * artists come from the server (see docs/VISIT_BOOKER.md); this file never decides what is free.
 *
 * Roles: "client" (asks a salon for a visit), "salon" (the salon enters its own customer),
 * "artist" (an independent artist enters their own customer).
 */
export const MAX_VISIT_SERVICES = MAX_BOOKING_PARTS;
export const ROLES = ["client", "salon", "artist"];

/** The salon's or artist's own service list as the form's services: one per name, with a length (same parser the server uses). */
export function normalizeServices(raw) {
  const seenKeys = new Set();
  const seenNames = new Set();
  const out = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const name = String(item?.name || "").trim();
    if (!name) continue;
    const key = serviceKey(item) || name;
    // A booking names its services, so two with one name could not be told apart.
    if (seenKeys.has(key) || seenNames.has(name)) continue;
    seenKeys.add(key);
    seenNames.add(name);
    out.push({
      key,
      name,
      minutes: parseServiceDurationMinutes(item.duration),
      price: parseTomanAmount(item.price),
      emoji: item.emoji || "",
      duration: String(item.duration || "")
    });
  }
  return out;
}

/** Picks as keys, in the order picked. Unknown keys and repeats are dropped; more than the limit are cut. */
export function sanitizeSelection(keys, services) {
  const known = new Set(services.map((service) => service.key));
  const out = [];
  for (const key of Array.isArray(keys) ? keys : []) {
    if (known.has(key) && !out.includes(key)) out.push(key);
  }
  return out.slice(0, MAX_VISIT_SERVICES);
}

/** Tap on a service: off if on, else on at the end. `limited` when the visit is already full. */
export function toggleSelection(keys, key, services) {
  if (keys.includes(key)) return { keys: keys.filter((item) => item !== key), limited: false };
  if (!services.some((service) => service.key === key)) return { keys, limited: false };
  if (keys.length >= MAX_VISIT_SERVICES) return { keys, limited: true };
  return { keys: [...keys, key], limited: false };
}

/** The picked services, in the order picked. */
export function pickedServices(keys, services) {
  return keys.map((key) => services.find((service) => service.key === key)).filter(Boolean);
}

/** Count, total minutes and price. The price is 0 (unknown) when any picked service has none. */
export function visitTotals(list) {
  const priced = list.length > 0 && list.every((service) => service.price > 0);
  return {
    count: list.length,
    minutes: list.reduce((sum, service) => sum + service.minutes, 0),
    price: priced ? list.reduce((sum, service) => sum + service.price, 0) : 0
  };
}

/** "۲ خدمت · ۷۵ دقیقه · ۹۵۰ تومان" for the line under the services. */
export function visitSummaryText(list) {
  if (!list.length) return "";
  const totals = visitTotals(list);
  return [
    `${toPersianDigits(totals.count)} خدمت`,
    `${toPersianDigits(totals.minutes)} دقیقه`,
    totals.price ? `${formatTomanNumber(totals.price)} تومان` : ""
  ].filter(Boolean).join(" · ");
}

/** Clock label comparison that ignores digit script and a leading zero. */
export const sameTime = (a, b) => Boolean(a) && Boolean(b) && timeLabelToMinutes(a) === timeLabelToMinutes(b);

/** "۱۰:۴۵" for a start plus minutes. */
export const endTimeLabel = (time, minutes) => minutesToPersianTime(timeLabelToMinutes(time) + minutes);

/** The picks that count as the form's state; every change that can alter what is free clears what was chosen after it. */
export function createState({ selected = [], day = "", name = "", phone = "" } = {}) {
  return { selected, day, time: "", name, phone, staff: {} };
}
export const withSelection = (state, selected) => ({ ...state, selected, time: "", staff: {} });
export const withDay = (state, day) => (state.day === day ? state : { ...state, day, time: "", staff: {} });
export const withTime = (state, time) => ({ ...state, time, staff: {} });
/** The salon hands service number `index` to `name` ("" goes back to the system's pick). */
export function withStaff(state, index, name) {
  const staff = { ...state.staff };
  if (name) staff[index] = name;
  else delete staff[index];
  return { ...state, staff };
}

/** Each service with its clock time, one after another (what the server's plan is, minus the artists). */
export function sequentialPlan(time, list) {
  if (!time || !list.length) return [];
  return scheduleBookingParts(time, list.map((service) => ({ service: service.name, minutes: service.minutes })))
    .map((part) => ({ service: part.service, minutes: part.minutes, start: part.startLabel, end: part.endLabel, staff: "" }));
}

/**
 * Whether the visit can be sent now, and if not what is missing (in the order the form is read).
 * `plan` is the server's answer for the chosen time: { status: "idle" | "loading" | "ok" | "problem" | "error" }.
 */
export function readiness(role, state, list, plan = { status: "ok" }) {
  const missing = [];
  if (!list.length) missing.push("خدمت");
  if (role !== "client" && !state.name.trim()) missing.push("نام مشتری");
  if (role === "client" && !String(state.phone || "").trim()) missing.push("شماره تماس");
  if (!state.time) missing.push("ساعت");
  if (missing.length) return { ok: false, missing, reason: "missing" };
  if (plan.status === "loading" || plan.status === "idle") return { ok: false, missing: [], reason: "checking" };
  if (plan.status === "problem") return { ok: false, missing: [], reason: "problem", message: plan.message || "" };
  if (plan.status === "error") return { ok: false, missing: [], reason: "error" };
  return { ok: true, missing: [], reason: "" };
}

/** "برای ثبت لازم است: خدمت، ساعت" */
export const missingText = (missing) => (missing.length ? `برای ثبت لازم است: ${missing.join("، ")}` : "");

/** The body of the booking request; the caller adds who is booking (the salon's id). */
export function buildSubmitBody(role, state, list) {
  const totals = visitTotals(list);
  const base = {
    time: state.time,
    client: state.name.trim(),
    phone: String(state.phone || "").trim(),
    service: joinServiceNames(list.map((service) => service.name)),
    durationMinutes: totals.minutes
  };
  if (role === "artist") {
    return { kind: "booking", ...base, date: state.day, status: "تایید" };
  }
  const body = { ...base, bookingDate: state.day };
  if (list.length >= 2) {
    // Several services go one by one so each gets its own artist; only the salon may name them.
    body.parts = list.map((service, index) => ({
      service: service.name,
      duration: service.duration || `${service.minutes} دقیقه`,
      ...(role === "salon" && state.staff[index] ? { staff: state.staff[index] } : {})
    }));
  } else if (role === "salon" && state.staff[0]) {
    body.staff = state.staff[0];
  }
  return body;
}

/** The query for the server's times and preview calls: services in order with their lengths, and the salon's own artist picks. */
export function visitQuery(state, list, { withStaff: includeStaff = false } = {}) {
  return {
    services: list.map((service) => ({ name: service.name, minutes: service.minutes })),
    staff: includeStaff ? list.map((_, index) => state.staff[index] || "") : []
  };
}

/** What to tell the person, and whether the free times must be asked for again, after a refused booking. */
export function submitFailure({ status = 0, payload = {} } = {}) {
  const error = typeof payload?.error === "string" && payload.error.trim() ? payload.error.trim() : "";
  if (status === 409) return { message: error || "این زمان دیگر آزاد نیست؛ ساعت دیگری انتخاب کن.", reloadTimes: true };
  if (status === 429) return { message: error || "درخواست‌های زیاد. کمی صبر کن.", reloadTimes: false };
  if (status === 401) return { message: "ورود تو منقضی شده؛ دوباره وارد شو.", reloadTimes: false };
  if (status === 0) return { message: "اتصال برقرار نشد؛ اینترنت را بررسی کن و دوباره امتحان کن.", reloadTimes: false };
  return { message: error || "ثبت رزرو انجام نشد؛ دوباره امتحان کن.", reloadTimes: false };
}

/** Persian digits for a server clock label such as "10:00". */
export const clockText = (time) => toPersianDigits(toLatinDigits(String(time || "")));
