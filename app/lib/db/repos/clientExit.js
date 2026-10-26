import { getDb, all, get } from "../connection.js";
import { clientBookingMatch } from "../clientMatch.js";
import * as salons from "./salons.js";
import * as artists from "./artists.js";
import * as users from "./users.js";
import { bookingStartMs } from "../../../shared/lib/reminderTiming.js";
import { NEAR_BOOKING_HOURS } from "../../../shared/lib/providerRules.js";
import { noticeProviderClientCancelled } from "../../clientCancelNotice.js";

/**
 * A client deleting their account (owner's decision 2026-10-26, the client side of «booking never broken without
 * notice»): a confirmed booking starting within NEAR_BOOKING_HOURS (24) blocks it until it is done or the client cancels
 * it themselves (after being told to call the salon first); every other live booking and waiting request is cancelled
 * together («لغو همه و پاک کردن حساب») and the salon or artist is told «… و حسابش رو از فرفرو پاک کرد». The bookings a
 * salon typed for the client's proved number count as theirs (same rule as the client's own list). The admin is never
 * blocked, but everything open is still cancelled with notice.
 */

const SALON_LIVE = ["تازه", "درخواست", "تایید شده", "در انتظار مشتری"];
const ARTIST_LIVE = ["تازه", "درخواست", "تایید", "تایید شده"];
const SALON_CONFIRMED = ["تایید شده", "تازه"];
const ARTIST_CONFIRMED = ["تایید شده", "تایید"];

function toItem(kind, row, now) {
  const start = bookingStartMs(row.booking_date || "", row.time || "", now);
  const minutes = Math.max(15, Number(row.duration_minutes) || 60);
  const confirmed = (kind === "salon" ? SALON_CONFIRMED : ARTIST_CONFIRMED).includes(row.status);
  return {
    kind,
    id: Number(row.id),
    status: row.status,
    confirmed,
    startMs: start,
    endMs: start === null ? null : start + minutes * 60000,
    near: confirmed && start !== null && start <= now.getTime() + NEAR_BOOKING_HOURS * 3600 * 1000,
    started: start !== null && start <= now.getTime(),
    date: row.booking_date || "",
    time: row.time || "",
    service: row.service || "",
    providerName: row.provider_name || "",
    providerPhone: row.provider_phone || "",
    providerUserId: Number(kind === "salon" ? row.salon_user_id : row.artist_user_id) || null
  };
}

/** The client's live bookings that have not ended yet, split into `near` (they block) and `rest`. */
export async function planClientExit(user, now = new Date()) {
  const db = await getDb();
  const match = clientBookingMatch(user, { alias: "b", startAt: 2 });
  if (!match.sql) return { items: [], near: [], rest: [] };
  const salonRows = await all(db, `
    SELECT b.*, COALESCE(NULLIF(s.name, ''), u.name) AS provider_name, COALESCE(NULLIF(s.phone, ''), u.phone) AS provider_phone
    FROM salon_bookings b
    LEFT JOIN users u ON u.id = b.salon_user_id
    LEFT JOIN salons s ON s.user_id = b.salon_user_id
    WHERE b.status = ANY($1) AND ${match.sql}
    ORDER BY b.booking_date, b.time
  `, [SALON_LIVE, ...match.params]);
  const artistRows = await all(db, `
    SELECT b.*, u.name AS provider_name, u.phone AS provider_phone
    FROM artist_bookings b
    LEFT JOIN users u ON u.id = b.artist_user_id
    WHERE b.source_salon_user_id IS NULL AND b.status = ANY($1) AND ${match.sql}
    ORDER BY b.booking_date, b.time
  `, [ARTIST_LIVE, ...match.params]);
  const items = [
    ...salonRows.map((row) => toItem("salon", row, now)),
    ...artistRows.map((row) => toItem("artist", row, now))
  ]
    .filter((item) => item.endMs === null || item.endMs > now.getTime())
    .sort((a, b) => (a.startMs ?? Infinity) - (b.startMs ?? Infinity));
  return { items, near: items.filter((item) => item.near), rest: items.filter((item) => !item.near) };
}

/** What the delete dialog shows. */
export function describeClientPlan(plan) {
  const view = (item) => ({
    kind: item.kind,
    id: item.id,
    confirmed: item.confirmed,
    near: item.near,
    started: item.started,
    date: item.date,
    time: item.time,
    service: item.service,
    providerName: item.providerName,
    providerPhone: item.providerPhone,
    providerType: item.kind
  });
  return {
    scope: "client",
    near: plan.near.map(view),
    rest: plan.rest.map(view),
    blocked: plan.near.length > 0,
    needsChoice: plan.near.length === 0 && plan.rest.length > 0
  };
}

/** Cancels one of the client's bookings as the client, and tells the salon or artist. → true when it was cancelled. */
async function cancelAsClient(item, user, { accountDeleted }) {
  const result = item.kind === "salon"
    ? await salons.cancelSalonBookingByClient(item.id, user)
    : await artists.cancelArtistBookingByClient(item.id, user);
  if (!result.ok) return false;
  noticeProviderClientCancelled(item.kind, result, { accountDeleted });
  return true;
}

const BLOCKED = (plan) => ({ ok: false, code: "NEAR_BOOKINGS", plan });
const NEEDS_CHOICE = (plan) => ({ ok: false, code: "HAS_BOOKINGS", plan });

/**
 * Deletes a client's account. → { ok: true } once it is gone, else { ok: false, code: "NEAR_BOOKINGS" | "HAS_BOOKINGS",
 * plan }. `cancelAll`: the client chose «لغو همه و پاک کردن حساب». `byAdmin`: not blocked; everything that can still be
 * cancelled is (a booking already under way is left to finish).
 */
export async function deleteClientAccount({ user: given, cancelAll = false, byAdmin = false }) {
  // The full row: walk-ins typed for the number only count once it was proved (phone_verified_at), and the admin path
  // passes a short row.
  const user = (await get(await getDb(), "SELECT id, phone, name, type, phone_verified_at FROM users WHERE id = $1", [Number(given.id)])) || given;
  const plan = await planClientExit(user);
  if (!byAdmin && plan.near.length) return BLOCKED(plan);
  if (!byAdmin && plan.rest.length && !cancelAll) return NEEDS_CHOICE(plan);
  for (const item of byAdmin ? plan.items : plan.rest) await cancelAsClient(item, user, { accountDeleted: true });
  // A booking that came in while these were being cancelled: never left behind without notice.
  const after = await planClientExit(user);
  if (!byAdmin && after.near.length) return BLOCKED(after);
  if (!byAdmin && after.rest.length) {
    for (const item of after.rest) await cancelAsClient(item, user, { accountDeleted: true });
  }
  if (byAdmin) {
    for (const item of after.items) await cancelAsClient(item, user, { accountDeleted: true });
  }
  await users.deleteUserDetachingPhone(user.id);
  return { ok: true };
}
