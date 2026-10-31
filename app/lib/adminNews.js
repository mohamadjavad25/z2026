import * as store from "./db/repos/adminNews.js";
import { pushAdmins } from "./adminPush.js";
import { adminPhoneList } from "./admin.js";
import { sendTemplateSms } from "./sms.js";
import { rialToToman } from "./billing/plans.js";
import { formatTomanNumber } from "../shared/lib/money.js";
import { toPersianDigits } from "../shared/lib/digits.js";

/**
 * The operator's news in the «فرفرو مدیر» app, so nobody has to open the admin panel to know what is going on
 * (owner's decisions of 2026-10-29, docs/DECISIONS.md):
 *   - one notification per kind (sign-ups, bookings) that replaces itself with the day's running count
 *     («ثبت‌نام امروز: ۳ نفر»), not one notification per person (fcm.js `tag`);
 *   - the count is per Tehran day, from midnight; a summary of the day comes at 22:00;
 *   - the phone rings for a kind at most every 15 minutes; what happens in between is told on the next ring
 *     (the cron route admin-watch flushes it within 5 minutes after the gap);
 *   - 23:00 to 08:00 is quiet for this routine news (told in the morning with the full count); urgent news
 *     (`alertAdmins`: server load, disk, memory, SMS failing, crashes, backups) always comes;
 *   - every admin in FRFRO_ADMIN_PHONES gets it in their own app; only urgent news falls back to an SMS, and only
 *     for an admin the app did not reach (pattern admin_alert, off until Faraz approves it).
 * Fire-and-forget from request handlers: never throws and never delays the response.
 */

export const RING_GAP_MS = 15 * 60 * 1000;
const URGENT_SMS_GAP_MS = 60 * 60 * 1000;
export const SUMMARY_HOUR = 22;
const QUIET_FROM = 23;
const QUIET_UNTIL = 8;

/** The hour (0-23) and the YYYY-MM-DD day in Tehran. */
export function tehranClock(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23"
  }).formatToParts(now).map((part) => [part.type, part.value]));
  return { hour: Number(parts.hour), day: `${parts.year}-${parts.month}-${parts.day}` };
}

export const isQuietHour = (now = new Date()) => {
  const { hour } = tehranClock(now);
  return hour >= QUIET_FROM || hour < QUIET_UNTIL;
};

const n = (value) => toPersianDigits(String(value));

const CANCELLED = new Set(["لغو", "لغو شده", "cancelled", "منقضی شده"]);
const WAITING = new Set(["درخواست", "تازه", "در انتظار مشتری"]);

/** Today's bookings by what the client sees: settled, still waiting for an answer, or cancelled / never answered. */
export function bookingGroups(byStatus = {}) {
  const groups = { total: 0, confirmed: 0, waiting: 0, cancelled: 0 };
  for (const [status, count] of Object.entries(byStatus)) {
    groups.total += count;
    if (CANCELLED.has(status)) groups.cancelled += count;
    else if (WAITING.has(status)) groups.waiting += count;
    else groups.confirmed += count;
  }
  return groups;
}

const TYPE_NAMES = [["client", "مشتری"], ["salon", "سالن"], ["artist", "آرتیست"]];

/** The text of one running-count notification. `counts` is store.todayCounts(), `label` the latest name. */
export function newsMessage(kind, counts, label = "") {
  const last = label ? ` · آخری: ${label}` : "";
  if (kind === "signups") {
    const total = TYPE_NAMES.reduce((sum, [type]) => sum + (counts.signups[type] || 0), 0);
    const parts = TYPE_NAMES.filter(([type]) => counts.signups[type]).map(([type, name]) => `${n(counts.signups[type])} ${name}`);
    return { title: `ثبت‌نام امروز: ${n(total)} نفر`, body: `${parts.join("، ") || "هنوز کسی نیست"}${last}`, url: "/admin?p=users" };
  }
  if (kind === "bookings") {
    const g = bookingGroups(counts.bookings);
    const parts = [
      g.confirmed && `${n(g.confirmed)} قطعی`,
      g.waiting && `${n(g.waiting)} منتظر جواب`,
      g.cancelled && `${n(g.cancelled)} لغو یا بی‌جواب`
    ].filter(Boolean);
    return { title: `نوبت‌های امروز: ${n(g.total)} تا`, body: `${parts.join("، ") || "هنوز نوبتی نیست"}${last}`, url: "/admin?p=bookings" };
  }
  return null;
}

/** The 22:00 summary of the day. `busy` is how many times the server watch called the server busy today. */
export function summaryMessage(counts, { busy = 0 } = {}) {
  const signups = TYPE_NAMES.reduce((sum, [type]) => sum + (counts.signups[type] || 0), 0);
  const g = bookingGroups(counts.bookings);
  const lines = [
    `ثبت‌نام: ${n(signups)}`,
    `نوبت: ${n(g.total)}${g.total ? ` (${n(g.confirmed)} قطعی)` : ""}`,
    `پرداخت: ${n(counts.payments.count)}${counts.payments.count ? `، ${formatTomanNumber(rialToToman(counts.payments.rial))} تومان` : ""}`,
    counts.openTickets ? `پیام پشتیبانی بی‌جواب: ${n(counts.openTickets)}` : "",
    busy ? `سرور امروز ${n(busy)} بار شلوغ شد` : "سرور امروز آروم بود"
  ].filter(Boolean);
  return { title: "خلاصهٔ امروز فرفرو", body: lines.join(" · "), url: "/admin" };
}

/** Rings for one kind now if it is allowed (not quiet, 15 minutes since the last ring, something waiting). */
async function ringIfDue(kind, now = new Date()) {
  if (isQuietHour(now)) return false;
  const row = await store.claim(kind, RING_GAP_MS);
  if (!row) return false;
  const message = newsMessage(kind, await store.todayCounts(), row.last_label);
  if (message) await pushAdmins({ ...message, tag: kind });
  return true;
}

/**
 * Something the operator counts happened: `kind` is "signups" or "bookings", `label` the name to show as the latest
 * («سالن گلاره»). Rings now when allowed, otherwise the cron tells it after the gap or in the morning.
 */
export function noteAdminEvent(kind, label = "") {
  if (!adminPhoneList().length) return;
  void (async () => {
    await store.markPending(kind, label);
    await ringIfDue(kind);
  })().catch(() => {});
}

/**
 * Urgent news, any hour: one push per `key` at most every `gapMs` (default an hour). An admin the app did not reach
 * gets the admin_alert SMS instead (sends nothing until its pattern is set). Awaitable; never throws.
 */
export async function alertAdmins(key, { title, body, url = "/admin?p=health", gapMs = URGENT_SMS_GAP_MS }) {
  try {
    const phones = adminPhoneList();
    if (!phones.length) return false;
    // Its own row, not checkRateLimit: rate_limit_hits is pruned after an hour, and the disk warning waits a day.
    await store.markPending(`alert-${key}`, "");
    if (!(await store.claim(`alert-${key}`, gapMs))) return false;
    const reached = await pushAdmins({ title, body, url, tag: `alert-${key}` });
    const rest = phones.filter((phone) => !reached.has(phone));
    await Promise.allSettled(rest.map((phone) => sendTemplateSms(phone, "admin_alert", { what: String(title).slice(0, 40) })));
    return true;
  } catch {
    return false;
  }
}

/**
 * The cron's part (every 5 minutes, /api/cron/admin-watch): tell what waited out its 15 minutes or the night, and send
 * the day's summary once after 22:00. `busyToday` comes from the server watch.
 */
export async function flushAdminNews(now = new Date(), { busyToday = 0 } = {}) {
  const told = [];
  if (!adminPhoneList().length) return { told, summary: false };
  for (const kind of await store.listPending()) {
    if (kind === "signups" || kind === "bookings") {
      if (await ringIfDue(kind, now)) told.push(kind);
    }
  }
  let summary = false;
  const { hour, day } = tehranClock(now);
  if (hour >= SUMMARY_HOUR) {
    const state = await store.readState("summary");
    if (state.day !== day) {
      await store.writeState("summary", { day });
      await pushAdmins({ ...summaryMessage(await store.todayCounts(), { busy: busyToday }), tag: "summary" });
      summary = true;
    }
  }
  return { told, summary };
}
