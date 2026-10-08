import { getDb, all } from "./db/connection.js";
import * as salons from "./db/repos/salons.js";
import * as artists from "./db/repos/artists.js";
import { sendPushToUser } from "./push.js";
import { isSlotInPast } from "../shared/lib/slots.js";

/**
 * Auto-expiry sweep for booking REQUESTS a salon/artist never actively
 * responded to (Snapp-Food-style bounded response window — founder-approved
 * product decision: 1 hour, auto-cancel on timeout, notify the client).
 * Covers two independent, non-overlapping sources:
 *
 * 1. `salon_bookings` rows with status "درخواست" (see
 *    confirmSalonClientBooking in useSalonDirectory.js) — the real
 *    confirm/reject action is approveReservationRequest/
 *    declineReservationRequest in useSalonWorkspace.js + PATCH
 *    /api/salon-bookings. When a salon booking has a linked staff member
 *    (staff -> salon_staff.artist_user_id), POST /api/salon-bookings mirrors
 *    it into artist_bookings with the SAME status, and PATCH
 *    /api/salon-bookings keeps that mirror in sync via
 *    salons.patchSalonBookingWithArtistSync. This sweep reuses that exact
 *    same atomic sync function to expire the salon row, so the mirrored
 *    artist_bookings row (if any) is expired in the same transaction — no
 *    separate artist_bookings query needed for the linked-staff case.
 *
 * 2. DIRECT `artist_bookings` rows (client booked an independent artist
 *    straight, not through a salon) with status "تازه" AND
 *    source_salon_user_id IS NULL — the real confirm/decline action is
 *    confirmArtistBookingRequest/declineArtistBookingRequest in
 *    useArtistWorkspace.js + PATCH /api/artist/me (kind: "booking"). The
 *    `source_salon_user_id IS NULL` filter is load-bearing: a salon-linked
 *    artist_bookings mirror row already gets expired via path (1) above
 *    (patchSalonBookingWithArtistSync operates on the SAME transaction as
 *    the salon row) — sweeping it a second time here would be a redundant
 *    second UPDATE + a duplicate "your booking expired" push notification
 *    for the same appointment.
 */

/** Status written to an expired booking — distinct from "درخواست" (still pending),
 *  "تازه"/"تایید شده" (never timed out) and "لغو" (actively rejected/cancelled by
 *  the salon), so the client-facing UI can eventually tell "salon said no" apart
 *  from "nobody answered in time". Chosen deliberately NOT to collide with any
 *  existing status literal in this codebase (grepped across booking code paths).
 */
export const BOOKING_REQUEST_EXPIRED_STATUS = "منقضی شده";

const DEFAULT_TIMEOUT_MINUTES = 60;

// Recommended external-scheduler interval for app/api/cron/expire-bookings
// (see vercel.json) -- timeout precision doesn't need to be tighter than
// this. Not read from here anymore (the old in-process setInterval this
// constant configured is gone -- see git history / docs/DEVLOG.md), kept
// only as the documented source of truth for what to put in the scheduler.
export const RECOMMENDED_SWEEP_INTERVAL_MS = 3 * 60 * 1000;

/** Test-speedup hook, same idea as ZIBABAN_BOOKING_PATCH_SYNC_TEST elsewhere in this file's neighbors:
 *  lets an isolated test shrink the window to seconds instead of waiting a real hour. */
function timeoutMinutes() {
  const override = Number(process.env.ZIBABAN_BOOKING_REQUEST_TIMEOUT_MINUTES);
  return Number.isFinite(override) && override > 0 ? override : DEFAULT_TIMEOUT_MINUTES;
}

/** A pending request can no longer be answered once its response window ran out or its appointment time has started. */
function keepUnanswerable(rows) {
  return rows.filter((row) => row.timed_out || isSlotInPast(row.booking_date, row.time));
}

/** Every still-pending ("درخواست") salon_bookings row whose created_at is older than the
 *  configured window, compared using the DB's own clock (NOW() - INTERVAL ...) — not JS
 *  Date.now() — so this is immune to any clock skew between the Node process and Postgres. */
async function findExpiredSalonBookingRequests(db, minutes) {
  return all(db, `
    SELECT id, salon_user_id, client_user_id, client, service, booking_date, time,
      (created_at <= (NOW() - ($1::double precision * INTERVAL '1 minute'))) AS timed_out
    FROM salon_bookings
    WHERE status = 'درخواست'
  `, [minutes]).then(keepUnanswerable);
}

/** Every still-pending ("تازه") DIRECT artist_bookings row (source_salon_user_id
 *  IS NULL — see the module docstring for why that filter matters) whose
 *  created_at is older than the configured window, same DB-clock comparison
 *  as findExpiredSalonBookingRequests above. */
async function findExpiredDirectArtistBookingRequests(db, minutes) {
  return all(db, `
    SELECT id, artist_user_id, client_user_id, client_name, service, booking_date, time,
      (created_at <= (NOW() - ($1::double precision * INTERVAL '1 minute'))) AS timed_out
    FROM artist_bookings
    WHERE status = 'تازه'
      AND source_salon_user_id IS NULL
  `, [minutes]).then(keepUnanswerable);
}

/** Push notifications for both sides of an expired salon booking request. */
function notifyClientOfExpiry(booking) {
  const clientUserId = Number(booking.client_user_id || 0);
  const salonUserId = Number(booking.salon_user_id || 0);
  if (!clientUserId || !salonUserId || clientUserId === salonUserId) return;
  void sendPushToUser(clientUserId, {
    title: "نوبت شما منقضی شد",
    body: `${booking.service || "نوبت"} — سالن به‌موقع پاسخ نداد و نوبت به‌طور خودکار لغو شد.`
  });
  // The owner-facing half of this fix — see recentlyExpiredSalonBookings in
  // HomeApp.jsx for the in-app counterpart. Before this, a salon that
  // ignored a request had literally zero signal anything happened: the
  // pending count just quietly dropped to zero.
  void sendPushToUser(salonUserId, {
    title: "یک درخواست رزرو منقضی شد",
    body: `${booking.client || "مشتری"} — ${booking.service || "نوبت"} به‌دلیل عدم پاسخ در ۱ ساعت منقضی شد.`
  });
}

/** Same idea as notifyClientOfExpiry, for a direct artist_bookings row. */
function notifyClientOfArtistBookingExpiry(booking) {
  const clientUserId = Number(booking.client_user_id || 0);
  const artistUserId = Number(booking.artist_user_id || 0);
  if (!clientUserId || !artistUserId || clientUserId === artistUserId) return;
  void sendPushToUser(clientUserId, {
    title: "نوبت شما منقضی شد",
    body: `${booking.service || "نوبت"} — آرتیست به‌موقع پاسخ نداد و نوبت به‌طور خودکار لغو شد.`
  });
  void sendPushToUser(artistUserId, {
    title: "یک درخواست نوبت منقضی شد",
    body: `${booking.client_name || booking.client || "مشتری"} — ${booking.service || "نوبت"} به‌دلیل عدم پاسخ در ۱ ساعت منقضی شد.`
  });
}

/**
 * Runs one sweep pass synchronously. Exported (not just used by the
 * self-starting interval below) so isolated tests can call it directly
 * instead of waiting for a real interval tick.
 * @returns {{ expired: number, attempted: number, salonExpired: number, artistExpired: number }}
 */
export async function sweepExpiredBookingRequestsOnce() {
  const db = await getDb();
  const minutes = timeoutMinutes();

  const staleSalon = await findExpiredSalonBookingRequests(db, minutes);
  let salonExpired = 0;
  for (const row of staleSalon) {
    // Reuse the exact same atomic salon+linked-artist status-sync path the
    // real PATCH /api/salon-bookings route uses (patchSalonBookingWithArtistSync) —
    // not a second, ad-hoc "just UPDATE the row" mechanism.
    const result = await salons.patchSalonBookingWithArtistSync(row.id, row.salon_user_id, {
      status: BOOKING_REQUEST_EXPIRED_STATUS
    }, { allowPast: true });
    if (result.ok) {
      salonExpired += 1;
      try {
        notifyClientOfExpiry(row);
      } catch {
        // Notification is best-effort; the booking is already correctly expired
        // even if the push notification failed to send.
      }
    }
    // If patch failed (e.g. a genuine slot conflict on the artist mirror),
    // leave the row as-is — created_at doesn't change, so the next sweep
    // pass retries it automatically.
  }

  const staleDirectArtist = await findExpiredDirectArtistBookingRequests(db, minutes);
  let artistExpired = 0;
  for (const row of staleDirectArtist) {
    // A plain single-row UPDATE (updateArtistBookingRow) is already atomic on
    // its own — unlike the salon case there's no linked mirror row to keep in
    // sync here (this query already excludes salon-linked rows), so no
    // withTransaction wrapper is needed.
    const updated = await artists.updateArtistBookingRow(row.id, { status: BOOKING_REQUEST_EXPIRED_STATUS });
    if (updated) {
      artistExpired += 1;
      try {
        notifyClientOfArtistBookingExpiry(row);
      } catch {
        // Notification is best-effort; the booking is already correctly expired
        // even if the push notification failed to send.
      }
    }
  }

  return {
    expired: salonExpired + artistExpired,
    attempted: staleSalon.length + staleDirectArtist.length,
    salonExpired,
    artistExpired
  };
}

let lastLazySweepAt = 0;
let lazySweepRunning = false;
const LAZY_SWEEP_EVERY_MS = 60 * 1000;

/**
 * Sweep on demand, at most once a minute per server instance. Serverless instances can't keep a timer
 * and no external scheduler is guaranteed, so the busy booking-list endpoints call this: a stale
 * request is closed the next time anyone opens a bookings list. Never throws, never blocks long.
 */
export async function sweepExpiredBookingRequestsIfDue() {
  const now = Date.now();
  if (lazySweepRunning || now - lastLazySweepAt < LAZY_SWEEP_EVERY_MS) return;
  lazySweepRunning = true;
  lastLazySweepAt = now;
  try {
    await sweepExpiredBookingRequestsOnce();
  } catch {
    // Best-effort: the next call (or the cron endpoint) retries.
  } finally {
    lazySweepRunning = false;
  }
}

// A self-starting setInterval used to live here (see git history) --
// removed because it has the same core problem it was trying to solve for
// booking expiry in the first place: on the app's actual Vercel serverless
// deployment target, function instances are ephemeral and scale to zero,
// so there's no guarantee any instance stays warm long enough for the
// interval to ever fire. sweepExpiredBookingRequestsOnce() is now called
// from app/api/cron/expire-bookings/route.js, triggered by an external
// scheduler (Supabase pg_cron or any other) on a real fixed schedule
// instead of an in-process timer with no reliability guarantee under this
// deployment model.
