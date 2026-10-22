import { getDb, all, run } from "./db/connection.js";
import * as salons from "./db/repos/salons.js";
import { sendPushToUser } from "./push.js";
import { bookingWhen, smsNewBookingRequest } from "./bookingSms.js";
import { isSlotInPast } from "../shared/lib/slots.js";
import { AWAITING_CLIENT } from "../shared/lib/bookingOffer.js";
import { sendToFallbackArtist, sendToFallbackSalon } from "./bookingFallback.js";

/**
 * Auto-expiry sweep for booking REQUESTS a salon/artist never actively
 * responded to. The response window is the client's choice, per request
 * (`wait_minutes`, user's decision 2026-10-18): an hour, after which the
 * request expires and the client is told (or, at a salon, is sent on to the
 * backup salon the client picked -- see bookingFallback.js), or none, in
 * which case it waits until its appointment starts. Either way a request
 * nobody answered closes once its appointment time has started.
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

// Recommended external-scheduler interval for app/api/cron/expire-bookings
// (see vercel.json) -- timeout precision doesn't need to be tighter than
// this. Not read from here anymore (the old in-process setInterval this
// constant configured is gone -- see git history / docs/DEVLOG.md), kept
// only as the documented source of truth for what to put in the scheduler.
export const RECOMMENDED_SWEEP_INTERVAL_MS = 3 * 60 * 1000;

/** Test-speedup hook, same idea as FRFRO_BOOKING_PATCH_SYNC_TEST elsewhere in this file's neighbors:
 *  lets an isolated test shrink the hour to seconds instead of waiting a real hour. Applies only to
 *  requests that have a window; null = use each request's own. */
function timeoutOverrideMinutes() {
  const override = Number(process.env.FRFRO_BOOKING_REQUEST_TIMEOUT_MINUTES);
  return Number.isFinite(override) && override > 0 ? override : null;
}

/** A pending request can no longer be answered once its response window ran out or its appointment time has started
 *  (the same rule the screens show -- see requestMinutesLeft in shared/lib/bookingWindow.js). */
function keepUnanswerable(rows) {
  return rows.filter((row) => row.timed_out || isSlotInPast(row.booking_date, row.time));
}

/** `timed_out`: the request has a window (wait_minutes) and its created_at is older than it, compared
 *  using the DB's own clock (NOW() - INTERVAL ...) — not JS Date.now() — so this is immune to any
 *  clock skew between the Node process and Postgres. A request with no window never times out. */
const TIMED_OUT_SQL = `(wait_minutes IS NOT NULL AND created_at <= (NOW() - (COALESCE($1::double precision, wait_minutes) * INTERVAL '1 minute')))`;

/** Every still-pending ("درخواست") salon_bookings row whose window ran out or whose appointment started. */
async function findExpiredSalonBookingRequests(db, override) {
  return all(db, `
    SELECT id, salon_user_id, client_user_id, client, phone, service, parts, booking_date, time, fallback_salon_user_id,
      ${TIMED_OUT_SQL} AS timed_out
    FROM salon_bookings
    WHERE status = 'درخواست'
  `, [override]).then(keepUnanswerable);
}

/** Every still-pending ("تازه") DIRECT artist_bookings row (source_salon_user_id
 *  IS NULL — see the module docstring for why that filter matters) whose
 *  window ran out or whose appointment started, same DB-clock comparison
 *  as findExpiredSalonBookingRequests above. */
async function findExpiredDirectArtistBookingRequests(db, override) {
  return all(db, `
    SELECT id, artist_user_id, client_user_id, client_name, client_phone, service, booking_date, time, fallback_artist_user_id,
      ${TIMED_OUT_SQL} AS timed_out
    FROM artist_bookings
    WHERE status = 'تازه'
      AND source_salon_user_id IS NULL
  `, [override]).then(keepUnanswerable);
}

/** A new time the salon offered that the client never answered, and whose appointment time has now started:
 *  it can't be accepted any more, so it is closed like any other unanswered request (it has no hour window
 *  of its own -- the salon moved it on purpose, and the client may take until it starts). */
async function findStartedSalonOffers(db) {
  const rows = await all(db, `
    SELECT id, salon_user_id, client_user_id, client, service, booking_date, time, FALSE AS timed_out
    FROM salon_bookings
    WHERE status = $1
  `, [AWAITING_CLIENT]);
  return rows.filter((row) => isSlotInPast(row.booking_date, row.time));
}

/** Push notifications for both sides of an expired salon booking request. `moved` is the request it
 *  was sent on to at the client's backup salon ({ salonName, booking }), when that went through. */
function notifyClientOfExpiry(booking, moved = null, triedBackup = false) {
  const clientUserId = Number(booking.client_user_id || 0);
  const salonUserId = Number(booking.salon_user_id || 0);
  if (!clientUserId || !salonUserId || clientUserId === salonUserId) return;
  const service = booking.service || "نوبت";
  if (moved) {
    void sendPushToUser(clientUserId, {
      title: `درخواستت رفت برای ${moved.salonName}`,
      body: `${service} — سالن اول در ۱ ساعت جواب نداد؛ همان درخواست را برای ${moved.salonName} فرستادیم.`
    });
  } else {
    void sendPushToUser(clientUserId, {
      title: "نوبت شما منقضی شد",
      body: triedBackup
        ? `${service} — سالن به‌موقع جواب نداد و سالن دومت هم این نوبت را نتوانست بگیرد.`
        : `${service} — سالن به‌موقع پاسخ نداد و نوبت به‌طور خودکار لغو شد.`
    });
  }
  // The owner-facing half of this fix — see recentlyExpiredSalonBookings in
  // HomeApp.jsx for the in-app counterpart. Before this, a salon that
  // ignored a request had literally zero signal anything happened: the
  // pending count just quietly dropped to zero.
  void sendPushToUser(salonUserId, {
    title: "یک درخواست رزرو منقضی شد",
    body: booking.timed_out
      ? `${booking.client || "مشتری"} — ${service} در زمانی که مشتری صبر کرد جواب نگرفت و منقضی شد.`
      : `${booking.client || "مشتری"} — ${service} تا شروع نوبت جواب نگرفت و منقضی شد.`
  });
  if (moved?.booking) {
    const push = sendPushToUser(Number(moved.booking.salon_user_id), {
      title: "درخواست رزرو جدید",
      body: `${moved.booking.client || "مشتری"} — ${moved.booking.service || service} · ${bookingWhen(moved.booking.booking_date, moved.booking.time)}`
    }).catch(() => null);
    smsNewBookingRequest(Number(moved.booking.salon_user_id), {
      client: moved.booking.client, service: moved.booking.service || service, bookingDate: moved.booking.booking_date, time: moved.booking.time
    }, push);
  }
}

/** Same idea as notifyClientOfExpiry, for a direct artist_bookings row (`moved`: { name, booking }). */
function notifyClientOfArtistBookingExpiry(booking, moved = null, triedBackup = false) {
  const clientUserId = Number(booking.client_user_id || 0);
  const artistUserId = Number(booking.artist_user_id || 0);
  if (!clientUserId || !artistUserId || clientUserId === artistUserId) return;
  const service = booking.service || "نوبت";
  if (moved) {
    void sendPushToUser(clientUserId, {
      title: `درخواستت رفت برای ${moved.name}`,
      body: `${service} — آرتیست اول در ۱ ساعت جواب نداد؛ همان درخواست را برای ${moved.name} فرستادیم.`
    });
  } else {
    void sendPushToUser(clientUserId, {
      title: "نوبت شما منقضی شد",
      body: triedBackup
        ? `${service} — آرتیست به‌موقع جواب نداد و آرتیست دومت هم این نوبت را نتوانست بگیرد.`
        : `${service} — آرتیست به‌موقع پاسخ نداد و نوبت به‌طور خودکار لغو شد.`
    });
  }
  void sendPushToUser(artistUserId, {
    title: "یک درخواست نوبت منقضی شد",
    body: booking.timed_out
      ? `${booking.client_name || booking.client || "مشتری"} — ${service} در زمانی که مشتری صبر کرد جواب نگرفت و منقضی شد.`
      : `${booking.client_name || booking.client || "مشتری"} — ${service} تا شروع نوبت جواب نگرفت و منقضی شد.`
  });
  if (moved?.booking) {
    const push = sendPushToUser(Number(moved.booking.artist_user_id), {
      title: moved.booking.status === "تایید شده" ? "نوبت جدید (تأیید خودکار)" : "درخواست نوبت جدید",
      body: `${moved.booking.client_name || "مشتری"} — ${moved.booking.service || service} · ${bookingWhen(moved.booking.booking_date, moved.booking.time)}`
    }).catch(() => null);
    if (moved.booking.status !== "تایید شده") {
      smsNewBookingRequest(Number(moved.booking.artist_user_id), {
        client: moved.booking.client_name, service: moved.booking.service || service, bookingDate: moved.booking.booking_date, time: moved.booking.time
      }, push);
    }
  }
}

/**
 * Runs one sweep pass synchronously. Exported (not just used by the
 * self-starting interval below) so isolated tests can call it directly
 * instead of waiting for a real interval tick.
 * @returns {{ expired: number, attempted: number, salonExpired: number, salonMoved: number, artistExpired: number, artistMoved: number }}
 */
export async function sweepExpiredBookingRequestsOnce() {
  await salons.ensureBookingColumns();
  const db = await getDb();
  const override = timeoutOverrideMinutes();

  const staleSalon = [
    ...await findExpiredSalonBookingRequests(db, override),
    ...await findStartedSalonOffers(db)
  ];
  let salonExpired = 0;
  let salonMoved = 0;
  for (const row of staleSalon) {
    // Reuse the exact same atomic salon+linked-artist status-sync path the
    // real PATCH /api/salon-bookings route uses (patchSalonBookingWithArtistSync) —
    // not a second, ad-hoc "just UPDATE the row" mechanism.
    const result = await salons.patchSalonBookingWithArtistSync(row.id, row.salon_user_id, {
      status: BOOKING_REQUEST_EXPIRED_STATUS
    }, { allowPast: true });
    if (result.ok) {
      salonExpired += 1;
      // The client gave this salon an hour and named a backup: the same request goes there now
      // (only for a window that ran out, never for an appointment that already started).
      let moved = null;
      const triedBackup = Boolean(row.timed_out && row.fallback_salon_user_id);
      if (triedBackup) {
        try {
          const sent = await sendToFallbackSalon(row);
          if (sent.ok) {
            moved = sent;
            salonMoved += 1;
          }
        } catch {
          // The backup is best-effort: the original is already correctly expired.
        }
      }
      try {
        notifyClientOfExpiry(row, moved, triedBackup);
      } catch {
        // Notification is best-effort; the booking is already correctly expired
        // even if the push notification failed to send.
      }
    }
    // If patch failed (e.g. a genuine slot conflict on the artist mirror),
    // leave the row as-is — created_at doesn't change, so the next sweep
    // pass retries it automatically.
  }

  const staleDirectArtist = await findExpiredDirectArtistBookingRequests(db, override);
  let artistExpired = 0;
  let artistMoved = 0;
  for (const row of staleDirectArtist) {
    // A plain single-row UPDATE (updateArtistBookingRow) is already atomic on
    // its own — unlike the salon case there's no linked mirror row to keep in
    // sync here (this query already excludes salon-linked rows), so no
    // withTransaction wrapper is needed.
    // Conditional on the status still being pending: the artist may have answered since the list was read.
    const updated = await run(db, `
      UPDATE artist_bookings SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND status = 'تازه' AND source_salon_user_id IS NULL
    `, [BOOKING_REQUEST_EXPIRED_STATUS, row.id]);
    if (updated.rowCount > 0) {
      artistExpired += 1;
      // Same as the salon case: the hour ran out and the client named a backup artist.
      let moved = null;
      const triedBackup = Boolean(row.timed_out && row.fallback_artist_user_id);
      if (triedBackup) {
        try {
          const sent = await sendToFallbackArtist(row);
          if (sent.ok) {
            moved = sent;
            artistMoved += 1;
          }
        } catch {
          // The backup is best-effort: the original is already correctly expired.
        }
      }
      try {
        notifyClientOfArtistBookingExpiry(row, moved, triedBackup);
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
    salonMoved,
    artistExpired,
    artistMoved
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
